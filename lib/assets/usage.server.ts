import { loadOrgAccess, type Actor } from "@/lib/content-model/access.server";
import type { DependencyImpact, DependencyItem, PlacementStatus } from "@/lib/content-model/contracts";
import { type Executor } from "@/lib/content-model/tx.server";
import "server-only";

const asStatus = (value: string): PlacementStatus =>
  value === "active" || value === "paused" || value === "archived" ? value : "draft";

/**
 * Everything that pins a version of the asset (drafts, published revisions,
 * placements of every status), optionally limited to one collection (scene
 * origin / placement owner). Dependencies always belong to the asset's
 * organization (tenant FKs), so a team member sees every item; anyone else
 * only gets the counts.
 */
export async function computeImpact(exec: Executor, actor: Actor, assetId: string, workspaceId?: string): Promise<DependencyImpact> {
  let drafts = exec
    .selectFrom("scene_asset_ref as r")
    .innerJoin("scene as s", "s.id", "r.scene_id")
    .leftJoin("workspace as w", "w.id", "s.workspace_id")
    .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
    .select(["s.id as scene_id", "s.name as scene_name", "s.workspace_id", "w.name as workspace_name", "r.resource_alias", "r.asset_version_id", "v.version_no"])
    .where("r.asset_id", "=", assetId);
  let revisions = exec
    .selectFrom("scene_revision_asset_ref as r")
    .innerJoin("scene_revision as sr", "sr.id", "r.scene_revision_id")
    .innerJoin("scene as s", "s.id", "sr.scene_id")
    .leftJoin("workspace as w", "w.id", "s.workspace_id")
    .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
    .select(["s.id as scene_id", "s.name as scene_name", "sr.id as scene_revision_id", "sr.revision_no", "s.workspace_id", "w.name as workspace_name", "r.resource_alias", "r.asset_version_id", "v.version_no"])
    .where("r.asset_id", "=", assetId);
  let placements = exec
    .selectFrom("placement as p")
    .innerJoin("workspace as w", "w.id", "p.workspace_id")
    .innerJoin("asset_version as v", "v.id", "p.asset_version_id")
    .select(["p.id as placement_id", "p.name as placement_name", "p.status", "w.id as workspace_id", "w.name as workspace_name", "p.asset_version_id", "v.version_no"])
    .where("p.asset_id", "=", assetId);
  if (workspaceId) {
    drafts = drafts.where("s.workspace_id", "=", workspaceId);
    revisions = revisions.where("s.workspace_id", "=", workspaceId);
    placements = placements.where("p.workspace_id", "=", workspaceId);
  }
  const [draftRows, revisionRows, placementRows, owner] = await Promise.all([
    drafts.execute(),
    revisions.execute(),
    placements.execute(),
    exec.selectFrom("asset").select("organization_id").where("id", "=", assetId).executeTakeFirst(),
  ]);
  const total = draftRows.length + revisionRows.length + placementRows.length;
  const org = owner?.organization_id ? await loadOrgAccess(exec, actor, owner.organization_id) : null;
  if (!org?.canRead) return { drafts: draftRows.length, revisions: revisionRows.length, placements: placementRows.length, items: [], restricted_count: total };
  const items: DependencyItem[] = [
    ...draftRows.map((r): DependencyItem => ({ kind: "scene_draft", ...r })),
    ...revisionRows.map((r): DependencyItem => ({ kind: "scene_revision", ...r })),
    ...placementRows.map((r): DependencyItem => ({
      kind: "placement",
      placement_id: r.placement_id,
      placement_name: r.placement_name,
      status: asStatus(r.status),
      workspace_id: r.workspace_id,
      workspace_name: r.workspace_name,
      asset_version_id: r.asset_version_id ?? "",
      version_no: r.version_no,
    })),
  ];
  return { drafts: draftRows.length, revisions: revisionRows.length, placements: placementRows.length, items, restricted_count: 0 };
}

export const hasDependencies = (impact: DependencyImpact) => impact.drafts + impact.revisions + impact.placements > 0;
