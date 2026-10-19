import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { auditSnapshot } from "./audit";
import { readSources, stableId, type MigrationReview } from "./review";
import { stageSources } from "./staging";
import type { ArchiveReviewEntry } from "./archive-review";

/** Runs inside the schema migrator's transaction, with the old application stopped.
 * Existing versioned content is never re-staged. Invalid unreviewed source rows
 * abort the entire upgrade; already quarantined rows are preserved in the archive.
 */
export async function migrateUnversionedContent(client: Client, mediaBaseUrl: string, archiveReview: ArchiveReviewEntry[] = []) {
  await client.query("lock table organization, workspace, asset, placement, scene in access exclusive mode");
  await client.query("select set_config('content_model.writer','migration',true)");
  const organizations = (await client.query<{ id: string }>("select id from organization order by id")).rows.map((r) => r.id);
  if (!organizations.length) return;
  const opts = { environment: "local" as const, organizations, runId: randomUUID(), apply: true };
  const report = await auditSnapshot(client, opts);
  const sources = await readSources(client, { ...report } as MigrationReview);
  const existingScenes = new Set((await client.query<{ legacy_asset_id: string }>("select legacy_asset_id from scene where legacy_asset_id is not null")).rows.map((r) => r.legacy_asset_id));
  const quarantined = new Set((await client.query<{ source_id: string }>("select source_id from content_migration_map where status='quarantined' and reason is not null")).rows.map((r) => r.source_id));
  for (const entry of archiveReview) {
    const mapping = report.mappings.find((item) => item.source_id === entry.assetId);
    if (!mapping || mapping.source_hash !== entry.sourceHash) throw new Error(`Archive review is stale for ${entry.assetId}; audit again before migrating`);
    if (mapping.targets.length || !mapping.issues.includes("no_valid_workspace") ||
      mapping.issues.some((issue) => issue !== "no_valid_workspace" && issue !== "missing_workspace") ||
      sources.get(entry.assetId)?.current_version_id || existingScenes.has(entry.assetId)) {
      throw new Error(`Archive review cannot quarantine owned or otherwise invalid asset ${entry.assetId}`);
    }
    if (!quarantined.has(entry.assetId)) {
      await client.query(`insert into content_migration_map(source_kind,source_id,source_row_hash,status,reason)
        values('asset',$1,$2,'quarantined',$3)`, [entry.assetId, entry.sourceHash, entry.reason]);
      quarantined.add(entry.assetId);
    }
  }
  const review: MigrationReview = { ...report, reviewed: true, review_notes: {}, media_base_urls: mediaBaseUrl ? [mediaBaseUrl] : [] };
  review.mappings = report.mappings.filter((mapping) => {
    const source = sources.get(mapping.source_id)!;
    return !source.current_version_id && !existingScenes.has(source.id) && !quarantined.has(source.id);
  });
  for (const mapping of review.mappings) {
    if (mapping.disposition === "isolate" || mapping.issues.includes("coordinate_reference_requires_review"))
      throw new Error(`Cannot migrate ${mapping.source_id}: ${mapping.issues.join(", ")}. Repair the source before retrying.`);
    if (mapping.kind === "anchor" && mapping.targets.length > 1)
      throw new Error(`Cross-team anchor ${mapping.source_id} must be split before migration`);
    mapping.disposition = "migrate";
    mapping.targets.forEach((target, index) => {
      target.target_id = index === 0 ? mapping.source_id : stableId("team-asset", target.organization_id, mapping.source_id);
      target.source_workspace_id = target.workspace_ids[0] ?? null;
    });
  }
  if (!review.mappings.length) return;
  await client.query("insert into content_migration_run(id,phase,status,organization_ids) values($1,'backfill','running',$2)", [opts.runId, organizations]);
  // No storage writes/deletes: carry the existing file references into resources.
  await stageSources(client, opts, review, sources, false);
  await client.query("update content_migration_run set status='staged',finished_at=now() where id=$1", [opts.runId]);
}
