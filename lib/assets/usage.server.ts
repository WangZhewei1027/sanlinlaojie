import "server-only";
import type { AssetGrantDto, DependencyImpact, DependencyItem, PlacementStatus } from "@/lib/content-model/contracts";
import { loadWorkspaceAccessMany, type Actor } from "@/lib/content-model/access.server";
import { toIsoRequired, type Executor } from "@/lib/content-model/tx.server";

const asStatus = (value: string): PlacementStatus =>
  value === "active" || value === "paused" || value === "archived" ? value : "draft";

/**
 * Everything that pins a version of the asset (drafts, published revisions,
 * placements of every status), optionally limited to one project. Names are
 * only returned for projects the caller can read (plan §5.1).
 */
export async function computeImpact(exec: Executor, actor: Actor, assetId: string, workspaceId?: string): Promise<DependencyImpact> {
  let drafts = exec
    .selectFrom("scene_asset_ref as r")
    .innerJoin("scene as s", "s.id", "r.scene_id")
    .innerJoin("workspace as w", "w.id", "s.workspace_id")
    .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
    .select(["s.id as scene_id", "s.name as scene_name", "w.id as workspace_id", "w.name as workspace_name", "r.resource_alias", "r.asset_version_id", "v.version_no"])
    .where("r.asset_id", "=", assetId);
  let revisions = exec
    .selectFrom("scene_revision_asset_ref as r")
    .innerJoin("scene_revision as sr", "sr.id", "r.scene_revision_id")
    .innerJoin("scene as s", "s.id", "sr.scene_id")
    .innerJoin("workspace as w", "w.id", "s.workspace_id")
    .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
    .select(["s.id as scene_id", "s.name as scene_name", "sr.id as scene_revision_id", "sr.revision_no", "w.id as workspace_id", "w.name as workspace_name", "r.resource_alias", "r.asset_version_id", "v.version_no"])
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
  const [draftRows, revisionRows, placementRows] = await Promise.all([drafts.execute(), revisions.execute(), placements.execute()]);
  const access = await loadWorkspaceAccessMany(exec, actor, [
    ...draftRows.map((r) => r.workspace_id),
    ...revisionRows.map((r) => r.workspace_id),
    ...placementRows.map((r) => r.workspace_id),
  ]);
  const readable = (id: string) => access.get(id)?.canRead === true;
  const items: DependencyItem[] = [];
  let restricted = 0;
  for (const r of draftRows) {
    if (!readable(r.workspace_id)) { restricted++; continue; }
    items.push({ kind: "scene_draft", ...r });
  }
  for (const r of revisionRows) {
    if (!readable(r.workspace_id)) { restricted++; continue; }
    items.push({ kind: "scene_revision", ...r });
  }
  for (const r of placementRows) {
    if (!readable(r.workspace_id)) { restricted++; continue; }
    items.push({
      kind: "placement",
      placement_id: r.placement_id,
      placement_name: r.placement_name,
      status: asStatus(r.status),
      workspace_id: r.workspace_id,
      workspace_name: r.workspace_name,
      asset_version_id: r.asset_version_id ?? "",
      version_no: r.version_no,
    });
  }
  return { drafts: draftRows.length, revisions: revisionRows.length, placements: placementRows.length, items, restricted_count: restricted };
}

export const hasDependencies = (impact: DependencyImpact) => impact.drafts + impact.revisions + impact.placements > 0;

export async function listGrants(exec: Executor, actor: Actor, assetId: string): Promise<AssetGrantDto[]> {
  const rows = await exec
    .selectFrom("asset_workspace_grant as g")
    .innerJoin("workspace as w", "w.id", "g.workspace_id")
    .select(["g.asset_id", "g.workspace_id", "w.name as workspace_name", "g.created_by", "g.created_at"])
    .where("g.asset_id", "=", assetId)
    .orderBy("g.created_at")
    .execute();
  const access = await loadWorkspaceAccessMany(exec, actor, rows.map((r) => r.workspace_id));
  const out: AssetGrantDto[] = [];
  for (const row of rows) {
    const readable = access.get(row.workspace_id)?.canRead === true;
    const impact = readable ? await computeImpact(exec, actor, assetId, row.workspace_id) : null;
    out.push({
      asset_id: row.asset_id,
      workspace_id: row.workspace_id,
      workspace_name: readable ? row.workspace_name : null,
      created_by: row.created_by,
      created_at: toIsoRequired(row.created_at),
      dependency_count: impact ? impact.drafts + impact.revisions + impact.placements : null,
    });
  }
  return out;
}
