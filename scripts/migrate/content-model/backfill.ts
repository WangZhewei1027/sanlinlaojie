import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import { auditSnapshot } from "./audit";
import { connect, fail, options, output, type MigrationOptions } from "./shared";
import { loadReview, readSources, reviewDigest, validateReview, type MigrationReview } from "./review";
import { migrationLock, stageSources } from "./staging";

export async function backfill(client: Client, opts: MigrationOptions, review: MigrationReview) {
  await client.query("begin isolation level repeatable read");
  try {
    await migrationLock(client,opts);
    const states = (await client.query<{content_model_state:string}>("select content_model_state from organization where id=any($1::uuid[])",[opts.organizations])).rows;
    if (states.some((s) => s.content_model_state === "v2")) throw new Error("Cannot backfill a live v2 organization");
    await validateReview(client,review,await auditSnapshot(client,opts));
    const existingRun=(await client.query<{organization_ids:string[];phase:string}>("select organization_ids,phase from content_migration_run where id=$1",[opts.runId])).rows[0];
    if(existingRun && JSON.stringify([...existingRun.organization_ids].sort())!==JSON.stringify(opts.organizations)) throw new Error("Run ID already belongs to another organization group");
    const previous = (await client.query<{source_id:string}>("select distinct source_id from content_migration_map where target_organization_id=any($1::uuid[]) and status in ('staged','applied') and source_kind<>'workspace_assignment'",[opts.organizations])).rows;
    const known = new Set(review.mappings.map((m) => m.source_id));
    const removed = previous.filter((m) => !known.has(m.source_id)).map((m) => m.source_id);
    if (removed.some((id) => !review.retire_source_ids?.includes(id) || !review.review_notes[id]?.trim())) throw new Error("SOURCE_REMOVED: explicitly list removed staged source IDs in retire_source_ids with review_notes");
    await client.query(`insert into content_migration_run(id,phase,status,organization_ids,notes) values($1,'backfill','running',$2,$3)
      on conflict(id) do update set phase='backfill',status='running',organization_ids=excluded.organization_ids,notes=excluded.notes,finished_at=null`,[opts.runId,opts.organizations,{source_fingerprint:review.source_fingerprint,review_digest:reviewDigest(review)}]);
    for (const sourceId of [...removed,...review.mappings.filter((m) => m.disposition === "isolate").map((m) => m.source_id)]) {
      await client.query("update asset set state='archived',archived_at=now() where id in (select target_id from content_migration_map where source_id=$1 and target_kind='asset' and target_organization_id=any($2::uuid[]))",[sourceId,opts.organizations]);
      await client.query("update scene set state='archived',archived_at=now() where id in (select target_id from content_migration_map where source_id=$1 and target_kind='scene' and target_organization_id=any($2::uuid[]))",[sourceId,opts.organizations]);
      await client.query(`update placement set status='paused' where id in (select target_id from content_migration_map where source_id=$1 and target_kind='placement' and target_organization_id=any($2::uuid[]))`,[sourceId,opts.organizations]);
      await client.query("update content_migration_map set status='quarantined',reason=$3,run_id=$4,updated_at=now() where source_id=$1 and target_organization_id=any($2::uuid[])",[sourceId,opts.organizations,review.review_notes[sourceId],opts.runId]);
    }
    for (const mapping of review.mappings.filter((m) => m.disposition === "migrate")) for (const target of mapping.targets) {
      const prior=(await client.query<{target_id:string}>("select target_id from content_migration_map where source_id=$1 and target_organization_id=$2 and target_kind=$3",[mapping.source_id,target.organization_id,mapping.kind === "scene" ? "scene" : "asset"])).rows[0];
      if(prior && prior.target_id !== target.target_id) throw new Error("Staged identity cannot be remapped; reuse the original reviewed split IDs");
    }
    await stageSources(client,opts,review,await readSources(client,review));
    await client.query("update organization set content_model_state=case when content_model_state='readonly' then 'readonly' else 'preparing' end,content_model_changed_at=now() where id=any($1::uuid[])",[opts.organizations]);
    await client.query("update content_migration_run set status='staged',finished_at=now() where id=$1",[opts.runId]);
    const summary = {phase:"backfill",dry_run:!opts.apply,run_id:opts.runId,organizations:opts.organizations,staged_sources:review.mappings.filter((m) => m.disposition === "migrate").length,isolated_sources:review.mappings.filter((m) => m.disposition === "isolate").length,retired_sources:removed.length,source_fingerprint:review.source_fingerprint};
    // Dry-run executes all SQL/constraints and rolls it back, including identities.
    await client.query(opts.apply ? "commit" : "rollback");
    return summary;
  } catch (error) { await client.query("rollback"); throw error; }
}
async function main() {
  const opts=options(); const review=loadReview(opts); const client=await connect(opts);
  try { output(await backfill(client,opts,review),opts.output); } finally { await client.end(); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(fail);
