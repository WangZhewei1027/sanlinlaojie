import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import { connect,fail,options,output,type MigrationOptions } from "./shared";
import { loadReview,type MigrationReview } from "./review";
import { migrationLock } from "./staging";
import { contentStateFingerprint } from "./cutover";

export async function rollback(client:Client,opts:MigrationOptions,_review:MigrationReview){
  await client.query("begin isolation level serializable");
  try{
    await migrationLock(client,opts);
    // Drain v2 writers that take an organization row lock before comparing state.
    const run=(await client.query<{notes:Record<string,unknown>;organization_ids:string[]}>("select notes,organization_ids from content_migration_run where id=$1 for update",[opts.runId])).rows[0];
    if(!run||JSON.stringify([...run.organization_ids].sort())!==JSON.stringify(opts.organizations))throw new Error("Run does not own this organization group");
    const states=(await client.query<{content_model_state:string}>("select content_model_state from organization where id=any($1::uuid[])",[opts.organizations])).rows;
    if(states.some((s)=>s.content_model_state==="v2")){
      if(states.some((s)=>s.content_model_state!=="v2")||!run.notes.cutover_state_fingerprint)throw new Error("Incomplete cutover cannot be rolled back automatically");
      if(await contentStateFingerprint(client,opts.organizations)!==run.notes.cutover_state_fingerprint)throw new Error("V2_WRITES_DETECTED: keep the new data and use a forward fix; legacy routing rollback is refused");
    }
    // Shadow rows/immutable snapshots are retained and remain hidden in legacy mode.
    await client.query("update organization set content_model_state='legacy',content_model_changed_at=now() where id=any($1::uuid[])",[opts.organizations]);
    await client.query("update content_migration_map set status='staged',updated_at=now() where run_id=$1 and status='applied'",[opts.runId]);
    await client.query("update content_migration_run set phase='rollback',status='completed',finished_at=now() where id=$1",[opts.runId]);
    await client.query(opts.apply?"commit":"rollback");
    return {phase:"rollback",dry_run:!opts.apply,run_id:opts.runId,retained_snapshots:true};
  }catch(error){await client.query("rollback");throw error;}
}
async function main(){const opts=options(),review=loadReview(opts),client=await connect(opts);try{output(await rollback(client,opts,review),opts.output);}finally{await client.end();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(fail);
