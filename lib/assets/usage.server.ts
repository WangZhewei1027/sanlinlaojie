import { loadOrgAccess, type Actor } from "@/lib/content-model/access.server";
import type { DependencyImpact, DependencyItem, PlacementStatus } from "@/lib/content-model/contracts";
import { type Executor } from "@/lib/content-model/tx.server";
import "server-only";

const asStatus = (value: string): PlacementStatus =>
  value === "active" || value === "paused" || value === "archived" ? value : "draft";

/**
 * Everything that references the asset (scenes and
 * placements of every status), optionally limited to one collection (scene
 * origin / placement owner). Dependencies always belong to the asset's
 * organization (tenant FKs), so a team member sees every item; anyone else
 * only gets the counts.
 */
export async function computeImpact(exec: Executor, actor: Actor, assetId: string, workspaceId?: string): Promise<DependencyImpact> {
  let scenes = exec
    .selectFrom("scene_asset_ref as r")
    .innerJoin("scene as s", "s.id", "r.scene_id")
    .leftJoin("workspace as w", "w.id", "s.workspace_id")
    .select(["s.id as scene_id", "s.name as scene_name", "s.workspace_id", "w.name as workspace_name", "r.resource_alias"])
    .where("r.asset_id", "=", assetId);
  let placements = exec
    .selectFrom("placement as p")
    .innerJoin("workspace as w", "w.id", "p.workspace_id")
    .select(["p.id as placement_id", "p.name as placement_name", "p.status", "w.id as workspace_id", "w.name as workspace_name"])
    .where("p.asset_id", "=", assetId);
  if (workspaceId) {
    scenes = scenes.where("s.workspace_id", "=", workspaceId);
    placements = placements.where("p.workspace_id", "=", workspaceId);
  }
  let activities = exec.selectFrom("activity_point as point").innerJoin("activity as a", "a.id", "point.activity_id")
    .select(["a.id as activity_id", "a.name as activity_name", "point.id as point_id", "point.name as point_name"])
    .where((eb) => eb.or([eb("point.image_asset_id", "=", assetId), eb("point.reward_asset_id", "=", assetId)]));
  if (workspaceId) activities = activities.where((eb) => eb.exists(eb.selectFrom("activity_placement as ap").select("ap.id").whereRef("ap.activity_id", "=", "a.id").where("ap.workspace_id", "=", workspaceId)));
  const [sceneRows, placementRows, activityRows, owner] = await Promise.all([
    scenes.execute(),
    placements.execute(),
    activities.execute(),
    exec.selectFrom("asset").select("organization_id").where("id", "=", assetId).executeTakeFirst(),
  ]);
  const total = sceneRows.length + placementRows.length + activityRows.length;
  const org = owner?.organization_id ? await loadOrgAccess(exec, actor, owner.organization_id) : null;
  if (!org?.canRead) return { scenes: sceneRows.length, placements: placementRows.length, activities: activityRows.length, items: [], restricted_count: total };
  const items: DependencyItem[] = [
    ...activityRows.map((row): DependencyItem => ({ kind: "activity", ...row })),
    ...sceneRows.map((r): DependencyItem => ({ kind: "scene", ...r })),
    ...placementRows.map((r): DependencyItem => ({
      kind: "placement",
      placement_id: r.placement_id,
      placement_name: r.placement_name,
      status: asStatus(r.status),
      workspace_id: r.workspace_id,
      workspace_name: r.workspace_name,
    })),
  ];
  return { scenes: sceneRows.length, placements: placementRows.length, activities: activityRows.length, items, restricted_count: 0 };
}

export const hasDependencies = (impact: DependencyImpact) => impact.scenes + impact.placements + (impact.activities ?? 0) > 0;
