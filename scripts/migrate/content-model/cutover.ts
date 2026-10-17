import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import { canonical,connect,fail,fingerprint,options,output,type MigrationOptions } from "./shared";
import { loadReview,type MigrationReview } from "./review";
import { migrationLock } from "./staging";
import { verify,verifySnapshot } from "./verify";

/** Conservative rollback watermark: includes content, ACLs and in-flight uploads. */
export async function contentStateFingerprint(client:Client,organizations:string[]):Promise<string>{
  const state:Record<string,unknown>={};
  state.organizations=(await client.query("select to_jsonb(o)-'content_model_state'-'content_model_changed_at' row from organization o where id=any($1::uuid[]) order by id",[organizations])).rows.map((r)=>r.row);
  const tables=["asset","asset_version","asset_workspace_grant","scene","scene_asset_ref","scene_revision","scene_revision_asset_ref","placement","legacy_runtime_binding","legacy_content_map","upload_receipt","content_command_idempotency","content_audit_log","organization_member"];
  for(const table of tables){
    const where=table==="asset" ? "organization_id=any($1::uuid[]) or workspace_id && array(select id from workspace where organization_id=any($1::uuid[]))" : "organization_id=any($1::uuid[])";
    state[table]=(await client.query(`select to_jsonb(t) row from ${table} t where ${where} order by to_jsonb(t)::text`,[organizations])).rows.map((r)=>r.row);
  }
  state.resources=(await client.query("select to_jsonb(r) row from asset_version_resource r join asset_version v on v.id=r.asset_version_id where v.organization_id=any($1::uuid[]) order by to_jsonb(r)::text",[organizations])).rows.map((r)=>r.row);
  state.workspaces=(await client.query("select to_jsonb(w) row from workspace w where organization_id=any($1::uuid[]) order by id",[organizations])).rows.map((r)=>r.row);
  state.assignments=(await client.query("select to_jsonb(a) row from workspace_assignment a join workspace w on w.id=a.workspace_id where w.organization_id=any($1::uuid[]) order by a.id",[organizations])).rows.map((r)=>r.row);
  state.tags=(await client.query("select to_jsonb(t) row from tag t join workspace w on w.id=t.workspace_id where w.organization_id=any($1::uuid[]) order by t.id",[organizations])).rows.map((r)=>r.row);
  state.placement_tags=(await client.query("select to_jsonb(t) row from placement_tag t join placement p on p.id=t.placement_id where p.organization_id=any($1::uuid[]) order by t.placement_id,t.tag_id",[organizations])).rows.map((r)=>r.row);
  return fingerprint(state);
}
export async function cutover(client:Client,opts:MigrationOptions,review:MigrationReview){
  const before=(await client.query<{content_model_state:string}>("select content_model_state from organization where id=any($1::uuid[])",[opts.organizations])).rows;
  if(before.length!==opts.organizations.length) throw new Error("Organization group is missing members");
  const run=(await client.query<{phase:string;status:string;organization_ids:string[]}>("select phase,status,organization_ids from content_migration_run where id=$1",[opts.runId])).rows[0];
  if(before.every((r)=>r.content_model_state==="v2")&&run?.phase==="cutover"&&run.status==="completed"&&canonical(run.organization_ids)===canonical(opts.organizations)) return {phase:"cutover",dry_run:!opts.apply,already_applied:true,run_id:opts.runId};
  if(!opts.apply) return {...await verify(client,opts,review),phase:"cutover",dry_run:true};
  // Commit readonly separately so a crash never silently reopens old writes.
  await client.query("begin isolation level repeatable read");
  try{
    await migrationLock(client,opts);
    const states=(await client.query<{content_model_state:string}>("select content_model_state from organization where id=any($1::uuid[])",[opts.organizations])).rows;
    if(states.some((s)=>!["preparing","readonly"].includes(s.content_model_state))) throw new Error("Stage the complete group before freezing");
    await client.query("update organization set content_model_state='readonly',content_model_changed_at=now() where id=any($1::uuid[])",[opts.organizations]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
  await client.query("begin isolation level serializable");
  try{
    await migrationLock(client,opts);
    const result=await verifySnapshot(client,opts,review);
    // No implicit content rewrite during activation: drift requires a new audited
    // backfill while readonly. Every appended version/revision then remains immutable.
    await client.query("update content_migration_map set status='applied',updated_at=now() where run_id=$1 and status='staged'",[opts.runId]);
    await client.query("update organization set content_model_state='v2',content_model_changed_at=now() where id=any($1::uuid[])",[opts.organizations]);
    const stateFingerprint=await contentStateFingerprint(client,opts.organizations);
    await client.query("update content_migration_run set phase='cutover',status='completed',finished_at=now(),notes=notes || $2::jsonb where id=$1",[opts.runId,JSON.stringify({cutover_state_fingerprint:stateFingerprint,cutover_at:new Date().toISOString()})]);
    await client.query("commit");
    return {...result,phase:"cutover",dry_run:false};
  }catch(error){await client.query("rollback");throw new Error(`Cutover stopped; organizations remain readonly. ${error instanceof Error?error.message:"Validation failed"}`);}
}
async function main(){const opts=options(),review=loadReview(opts),client=await connect(opts);try{output(await cutover(client,opts,review),opts.output);}finally{await client.end();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(fail);
