import { pathToFileURL } from "node:url";
import { connect,fail,options,output } from "./shared";
import { enumerateResources,loadReview,readSources } from "./review";

/** Produces a read-only inspection checklist. It never infers object existence. */
async function main(){
  const opts=options();if(opts.apply)throw new Error("inventory only emits a checklist; --apply is not accepted");
  const review=loadReview(opts),client=await connect(opts);
  try{
    const sources=await readSources(client,review);
    const candidates=[];
    for(const mapping of review.mappings.filter((m)=>m.disposition==="migrate"&&m.kind!=="scene")){
      const source=sources.get(mapping.source_id);if(!source)throw new Error("Source changed; re-audit first");
      for(const resource of enumerateResources(source,review,false)) candidates.push({source_id:source.id,...resource});
    }
    output({format:"content-model-resource-checklist-v1",run_id:opts.runId,candidates,note:"Verify each managed key with an authorized read-only storage inventory/HEAD. Copy only confirmed entries into resource_inventory with exists:true and checked_at. Add confirmed historical audio_compat files explicitly; absence is never inferred."},opts.output);
  }finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(fail);
