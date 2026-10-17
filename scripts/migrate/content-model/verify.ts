import { pathToFileURL } from "node:url";
import type { Client } from "pg";
import type { SceneDocumentV3 } from "../../../lib/scene/protocol";
import { compileSceneManifest } from "../../../lib/scene/compile";
import { auditSnapshot } from "./audit";
import { canonical,connect,fail,fingerprint,options,output,type MigrationOptions } from "./shared";
import { enumerateResources,loadReview,readSources,reviewDigest,validateReview,type MigrationReview } from "./review";
import { legacyAltitude,legacyPayload } from "./staging";

export async function verifySnapshot(client: Client,opts: MigrationOptions,review: MigrationReview) {
  await validateReview(client,review,await auditSnapshot(client,opts));
  const run=(await client.query<{notes:Record<string,unknown>;status:string}>("select notes,status from content_migration_run where id=$1",[opts.runId])).rows[0];
  if(!run || !["staged","completed"].includes(run.status) || run.notes.review_digest!==reviewDigest(review)) throw new Error("Stage this exact reviewed file before verifying/cutting over");
  const sources=await readSources(client,review);
  let assetVersions=0, scenes=0, placements=0;
  const mapped=async (sourceId:string,org:string,kind:string) => {
    const row=(await client.query<{target_id:string;source_row_hash:string;status:string}>("select target_id,source_row_hash,status from content_migration_map where run_id=$1 and source_id=$2 and target_organization_id=$3 and target_kind=$4",[opts.runId,sourceId,org,kind])).rows[0];
    const source=review.mappings.find((m)=>m.source_id===sourceId)!;
    if(!row || !["staged","applied"].includes(row.status) || row.source_row_hash!==source.dependency_hash) throw new Error(`Missing/stale ${kind} mapping for ${sourceId}`);
    return row.target_id;
  };
  for(const mapping of review.mappings) {
    if(mapping.disposition==="isolate") {
      const active=await client.query("select 1 from placement p join content_migration_map m on m.target_id=p.id and m.target_kind='placement' where m.source_id=$1 and p.status='active' and p.organization_id=any($2::uuid[])",[mapping.source_id,opts.organizations]);
      if(active.rowCount) throw new Error("Isolated source still has an active staged placement");
      continue;
    }
    const source=sources.get(mapping.source_id)!;
    for(const target of mapping.targets) {
      const identity=await mapped(mapping.source_id,target.organization_id,mapping.kind==="scene" ? "scene" : "asset");
      if(identity!==target.target_id) throw new Error("Identity differs from reviewed mapping");
      if(mapping.kind!=="scene") {
        const asset=(await client.query<{organization_id:string;origin_workspace_id:string|null;maintained_by:string|null;visibility:string;state:string;name:string|null;file_type:string}>("select organization_id,origin_workspace_id,maintained_by,visibility,state,name,file_type from asset where id=$1",[identity])).rows[0];
        if(!asset || asset.organization_id!==target.organization_id || asset.origin_workspace_id!==target.source_workspace_id || asset.maintained_by!==target.maintained_by || asset.visibility!=="restricted" || asset.state!=="active" || asset.name!==source.name || asset.file_type!==source.file_type) throw new Error("Asset identity differs from the reviewed ownership/maintenance mapping");
        const versionId=await mapped(mapping.source_id,target.organization_id,"asset_version");
        const version=(await client.query<{payload:unknown;asset_id:string;current_version_id:string}>("select v.payload,v.asset_id,a.current_version_id from asset_version v join asset a on a.id=v.asset_id where v.id=$1",[versionId])).rows[0];
        if(!version || version.asset_id!==identity || version.current_version_id!==versionId || fingerprint(version.payload)!==fingerprint(legacyPayload(source))) throw new Error("Asset snapshot differs from legacy source");
        const resources=(await client.query("select role,ordinal,storage_key,external_url,content_hash,mime_type,size_bytes from asset_version_resource where asset_version_id=$1 order by role,ordinal",[versionId])).rows;
        const expected=enumerateResources(source,review).sort((a,b)=>a.role.localeCompare(b.role)||a.ordinal-b.ordinal);
        if(canonical(resources)!==canonical(expected)) throw new Error("Resource manifest differs from reviewed inventory");
        const grants=(await client.query<{workspace_id:string}>("select workspace_id from asset_workspace_grant where asset_id=$1 order by workspace_id",[identity])).rows.map((g)=>g.workspace_id);
        if(canonical(grants)!==canonical(target.workspace_ids)) throw new Error("Project grants differ from legacy visibility");
        assetVersions++;
      } else {
        scenes++;
        const scene=(await client.query<{draft_document:SceneDocumentV3;workspace_id:string}>("select draft_document,workspace_id from scene where id=$1",[identity])).rows[0];
        if(!scene || scene.workspace_id!==target.source_workspace_id || scene.draft_document.schemaVersion!==3) throw new Error("Invalid staged scene ownership/document");
        const legacyDocument=JSON.parse(source.text_content!);
        const expectedDocument={schemaVersion:3,content:{...legacyDocument.content,assets:{} as Record<string,{assetId:string;assetVersionId:string}>}};
        for(const [alias,ref] of Object.entries(legacyDocument.content.assets) as [string,{assetId:string}][]) expectedDocument.content.assets[alias]={assetId:await mapped(ref.assetId,target.organization_id,"asset"),assetVersionId:await mapped(ref.assetId,target.organization_id,"asset_version")};
        if(fingerprint(scene.draft_document)!==fingerprint(expectedDocument)) throw new Error("Scene document differs from the reviewed fixed-version rewrite");
        const refs=(await client.query<{resource_alias:string;asset_id:string;asset_version_id:string}>("select resource_alias,asset_id,asset_version_id from scene_asset_ref where scene_id=$1",[identity])).rows;
        if(refs.length!==Object.keys(scene.draft_document.content.assets).length) throw new Error("Draft reverse references are incomplete");
        for(const ref of refs) if(canonical(scene.draft_document.content.assets[ref.resource_alias])!==canonical({assetId:ref.asset_id,assetVersionId:ref.asset_version_id})) throw new Error("Draft reverse reference is stale");
        if(target.create_placement) {
          const revisionId=await mapped(mapping.source_id,target.organization_id,"scene_revision");
          const revision=(await client.query<{document:SceneDocumentV3}>("select document from scene_revision where id=$1 and scene_id=$2",[revisionId,identity])).rows[0];
          if(!revision || fingerprint(revision.document)!==fingerprint(scene.draft_document)) throw new Error("Migration revision differs from the final draft");
          const revisionRefs=(await client.query<{resource_alias:string;asset_id:string;asset_version_id:string}>("select resource_alias,asset_id,asset_version_id from scene_revision_asset_ref where scene_revision_id=$1",[revisionId])).rows;
          if(revisionRefs.length!==refs.length || revisionRefs.some((ref)=>canonical(revision.document.content.assets[ref.resource_alias])!==canonical({assetId:ref.asset_id,assetVersionId:ref.asset_version_id}))) throw new Error("Published reverse references are incomplete or stale");
          const resources:Record<string,{assetId:string;url:string}>={};
          for(const [alias,ref] of Object.entries(revision.document.content.assets)) {
            const resource=(await client.query<{external_url:string|null;storage_key:string|null}>("select external_url,storage_key from asset_version_resource where asset_version_id=$1 and role='primary' order by ordinal limit 1",[ref.assetVersionId])).rows[0];
            if(!resource) throw new Error("Scene model has no fixed primary resource");
            resources[alias]={assetId:ref.assetId,url:resource.external_url ?? `${review.media_base_urls[0]}/${resource.storage_key}`};
          }
          const manifest=compileSceneManifest(source.id,revision.document,resources);
          const legacy=JSON.parse(source.text_content!);
          if(manifest.assetId!==source.id || fingerprint(manifest.content.instances)!==fingerprint(legacy.content.instances) || manifest.content.loop!==legacy.content.loop || manifest.content.durationSeconds!==legacy.content.durationSeconds) throw new Error("Playback compilation changed legacy scene behavior");
        } else if((await client.query("select 1 from scene_revision where scene_id=$1",[identity])).rowCount) throw new Error("Unplaced legacy draft was automatically published");
      }
      if(target.create_placement) {
        const id=await mapped(source.id,target.organization_id,"placement");
        const p=(await client.query<{workspace_id:string;status:string;public_id:string;config:unknown;longitude:number|null;latitude:number|null;asset_version_id:string|null;scene_revision_id:string|null;asset_id:string|null;anchor_id:string|null;altitude:number|null;is_huge:boolean}>(`select p.workspace_id,p.status,p.asset_id,p.asset_version_id,p.scene_revision_id,p.anchor_id,p.altitude,(p.render_config->>'is_huge')::boolean is_huge,b.public_id,p.render_config->'config' config,ST_X(p.location) longitude,ST_Y(p.location) latitude from placement p join legacy_runtime_binding b on b.placement_id=p.id where p.id=$1`,[id])).rows[0];
        if(!p || p.workspace_id!==target.source_workspace_id || p.status!=="active" || p.public_id!==source.id || canonical(p.config)!==canonical(source.config??{}) || p.longitude!==(source.longitude??null) || p.latitude!==(source.latitude??null)) throw new Error("Placement/public identity/config differs from source");
        const fixedId=await mapped(source.id,target.organization_id,mapping.kind==="scene"?"scene_revision":"asset_version");
        if((mapping.kind==="scene"?p.scene_revision_id:p.asset_version_id)!==fixedId) throw new Error("Placement target is not the final staged version");
        if(p.anchor_id!==source.anchor_id || p.is_huge!==(source.is_huge??false) || p.altitude!==legacyAltitude(source) || (mapping.kind!=="scene" && p.asset_id!==target.target_id)) throw new Error("Placement identity/anchor/render fields differ from source");
        const scopes=(await client.query<{workspace_id:string;tag_ids:string[]}>("select m.workspace_id,m.tag_ids from legacy_content_map m join legacy_runtime_binding b on b.id=m.binding_id where b.placement_id=$1 and m.active order by m.workspace_id",[id])).rows;
        if(canonical(scopes.map((scope)=>scope.workspace_id))!==canonical(target.workspace_ids)) throw new Error("Legacy public scopes differ from source");
        for(const scope of scopes){
          const expectedTags=(await client.query<{id:string}>("select id from tag where workspace_id=$1 and id=any($2::uuid[]) order by id",[scope.workspace_id,source.tag_ids??[]])).rows.map((tag)=>tag.id);
          if(canonical([...scope.tag_ids].sort())!==canonical(expectedTags))throw new Error("Legacy scope tags differ from source");
          if(scope.workspace_id===target.source_workspace_id){
            const actualTags=(await client.query<{tag_id:string}>("select tag_id from placement_tag where placement_id=$1 order by tag_id",[id])).rows.map((tag)=>tag.tag_id);
            if(canonical(actualTags)!==canonical(expectedTags))throw new Error("Placement tags differ from the owner project scope");
          }
        }
        placements++;
      }
    }
  }
  return {phase:"verify",run_id:opts.runId,source_fingerprint:review.source_fingerprint,asset_versions:assetVersions,scenes,placements,isolated:review.mappings.filter((m)=>m.disposition==="isolate").length};
}
export async function verify(client:Client,opts:MigrationOptions,review:MigrationReview) {
  await client.query("begin isolation level repeatable read read only");
  try { const result=await verifySnapshot(client,opts,review); await client.query("commit"); return result; }
  catch(error){await client.query("rollback");throw error;}
}
async function main(){const opts=options();if(opts.apply) throw new Error("verify is read-only; --apply is not accepted");const review=loadReview(opts);const client=await connect(opts);try{output(await verify(client,opts,review),opts.output);}finally{await client.end();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(fail);
