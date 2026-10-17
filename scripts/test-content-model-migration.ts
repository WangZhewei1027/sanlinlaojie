/** Destructive fixture only in the dedicated content_migration test database.
 * Explicit DATABASE_URL required. Never loads .env or calls object storage.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { audit } from "./migrate/content-model/audit";
import { backfill } from "./migrate/content-model/backfill";
import { cutover } from "./migrate/content-model/cutover";
import { rollback } from "./migrate/content-model/rollback";
import { verify,verifySnapshot } from "./migrate/content-model/verify";
import { enumerateResources,stableId,type MigrationReview } from "./migrate/content-model/review";
import { connect,type MigrationOptions } from "./migrate/content-model/shared";

const id=(n:number)=>`10160000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const orgs=[id(10),id(11)];
const ws=[id(20),id(21),id(22)];
const assets={model:id(40),scene:id(41),draft:id(42),shop:id(43),anchor:id(44),image:id(45),link:id(46),crossScene:id(47),bad:id(48),audio:id(49)};
const base="https://migration-media.example.test";
const opts:MigrationOptions={environment:"local",organizations:orgs,runId:id(1),apply:true};
const document=JSON.stringify({schemaVersion:2,content:{kind:"composition",units:"meters",durationSeconds:10,loop:false,assets:{model:{assetId:assets.model}},instances:[{id:"test-instance",asset:"model",position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1],animation:null}]}});

async function seed(client:Client){
  assert.equal((await client.query("select count(*)::int n from asset")).rows[0].n,0,"Use a newly created dedicated fixture database; never overwrite a prior run");
  for(const org of orgs)await client.query("insert into organization(id,name) values($1,$2)",[org,`migration-test-${org}`]);
  for(const [workspace,org]of [[ws[0],orgs[0]],[ws[1],orgs[0]],[ws[2],orgs[1]]])await client.query("insert into workspace(id,name,organization_id) values($1,'Migration fixture',$2)",[workspace,org]);
  const rows=[
    {id:assets.model,kind:"model",workspaces:[ws[0],ws[1],ws[2]],url:`${base}/assets/model.glb`,metadata:{dimensions:{width:1,height:2,depth:3}}},
    {id:assets.scene,kind:"scene",workspaces:[ws[0],ws[1]],text:document,gps:"POINT(121.5 31.2)",config:{scale:2}},
    {id:assets.draft,kind:"scene",workspaces:[ws[0]],text:document},
    {id:assets.crossScene,kind:"scene",workspaces:[ws[0],ws[2]],text:document,gps:"POINT(121.6 31.3)"},
    {id:assets.shop,kind:"shop",workspaces:[ws[0]],url:`${base}/assets/shop.jpg`,metadata:{checkin_url:`${base}/assets/shop-checkin.jpg`}},
    {id:assets.anchor,kind:"anchor",workspaces:[ws[0]],url:`${base}/assets/anchor.jpg`,gps:"POINT(121.5 31.2)"},
    {id:assets.image,kind:"image",workspaces:[ws[0]],url:"https://external.example.test/picture.jpg",anchor:assets.anchor},
    {id:assets.link,kind:"link",workspaces:[ws[0]],url:`${base}/assets/link-preview.jpg`,config:{link:{originalUrl:"https://example.test/story",previewUrl:`${base}/assets/link-preview.jpg`,linkType:"website"}},gps:"POINT(121.5 31.2)"},
    {id:assets.audio,kind:"audio",workspaces:[ws[0]],url:`${base}/assets/sound.webm`,gps:"POINT(121.5 31.2)"},
    {id:assets.bad,kind:"scene",workspaces:[ws[0]],text:"{broken"},
  ];
  for(const row of rows) await client.query(`insert into asset(id,name,file_type,workspace_id,file_url,text_content,location,metadata,config,anchor_id) values($1,'Migration fixture',$2,$3,$4,$5,ST_GeomFromText($6,4326),$7,$8,$9)`,[row.id,row.kind,row.workspaces,row.url??null,row.text??null,row.gps??null,row.metadata??{},row.config??{},row.anchor??null]);
}
async function reviewed(client:Client,runId=opts.runId):Promise<MigrationReview>{
  const report=await audit(client,{...opts,runId});
  const review:MigrationReview={...report,reviewed:true,review_notes:{},media_base_urls:[base],resource_inventory:["model.glb","model-v2.glb","shop.jpg","shop-checkin.jpg","anchor.jpg","link-preview.jpg","sound.webm","sound.m4a"].map((key)=>({storage_key:`assets/${key}`,exists:true,checked_at:new Date().toISOString(),size_bytes:128})),additional_resources:[{source_id:assets.audio,role:"audio_compat",url:`${base}/assets/sound.m4a`}]};
  for(const mapping of review.mappings){
    review.review_notes[mapping.source_id]=mapping.disposition==="isolate"?"Fixture intentionally preserves malformed content in quarantine":"Fixture explicitly assigns primary A project and splits B identity";
    if(mapping.disposition==="isolate")continue;
    mapping.disposition="migrate";
    for(const target of mapping.targets){
      target.target_id=target.organization_id===orgs[0]?mapping.source_id:stableId("fixture-split",mapping.source_id,target.organization_id);
      if(mapping.targets.length===1) target.target_id=mapping.source_id;
      if(target.create_placement||mapping.kind==="scene")target.source_workspace_id=target.organization_id===orgs[0]?ws[0]:ws[2];
    }
  }
  return review;
}
async function count(client:Client,table:string){assert.ok(["asset_version","scene_revision","placement"].includes(table));return(await client.query(`select count(*)::int n from ${table}`)).rows[0].n as number;}

async function snapshotGuardCheck(client:Client){
  const organization=randomUUID(),workspace=randomUUID(),asset=randomUUID();
  const stale=new Client({connectionString:process.env.DATABASE_URL});await stale.connect();
  try {
    await client.query("insert into organization(id,name) values($1,'snapshot-guard-fixture')",[organization]);
    await client.query("insert into workspace(id,name,organization_id) values($1,'snapshot-guard-fixture',$2)",[workspace,organization]);
    await client.query("insert into asset(id,file_type,text_content,workspace_id) values($1,'text','original',$2)",[asset,[workspace]]);
    await stale.query("begin isolation level repeatable read");
    await stale.query("select content_model_state from organization where id=$1",[organization]);
    await client.query("begin");
    await client.query("lock table asset in share row exclusive mode");
    await client.query("update organization set content_model_state='v2' where id=$1",[organization]);
    await client.query("commit");
    await assert.rejects(stale.query("update asset set text_content='stale snapshot write' where id=$1",[asset]),/serialize|UPGRADE_REQUIRED/i,"A pre-cutover REPEATABLE READ snapshot must not write legacy content after v2 activation");
    console.log("PASS stale REPEATABLE READ legacy writer is rejected after cutover");
  } finally {
    await stale.query("rollback");await stale.end();
    await client.query("begin");
    await client.query("select set_config('content_model.writer','purge',true)");
    await client.query("delete from asset where id=$1",[asset]);
    await client.query("delete from workspace where id=$1",[workspace]);
    await client.query("delete from organization where id=$1",[organization]);
    await client.query("commit");
  }
}

async function main(){
  assert.ok(process.env.DATABASE_URL,"Set dedicated test DATABASE_URL");
  const url=new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"55439");assert.ok(["/content_migration","/team_wb_migration"].includes(url.pathname),"Only a dedicated migration fixture database is permitted");assert.equal(url.username,"postgres");
  const client=await connect(opts);
  try{
    if(process.argv.includes("--snapshot-guard-only")){await snapshotGuardCheck(client);return;}
    await seed(client);
    let review=await reviewed(client);
    const badReview=structuredClone(review);badReview.mappings.find((m)=>m.source_id===assets.model)!.targets[0].target_id=null;
    await assert.rejects(backfill(client,opts,badReview),/identity/);
    const inventoryMissing=structuredClone(review);inventoryMissing.resource_inventory=[];
    await assert.rejects(backfill(client,opts,inventoryMissing),/UNVERIFIED_RESOURCE/);
    assert.throws(()=>enumerateResources({id:assets.image,file_type:"image",file_url:"https://external.example.test/x.jpg",metadata:{unknown:`${base}/assets/hidden.jpg`},config:{},content_hash:null} as never,review),/UNCLASSIFIED_MANAGED_RESOURCE/);
    assert.throws(()=>enumerateResources({id:assets.image,file_type:"image",file_url:"https://external.example.test/x.jpg",text_content:`inline ${base}/assets/hidden.jpg text`,metadata:{},config:{},content_hash:null} as never,review),/UNCLASSIFIED_MANAGED_RESOURCE/);
    console.log("PASS explicit mapping and managed-resource inventory guards");
    await backfill(client,{...opts,apply:false},review);
    assert.equal(await count(client,"asset_version"),0);
    assert.equal((await client.query("select content_model_state from organization where id=$1",[orgs[0]])).rows[0].content_model_state,"legacy");
    await backfill(client,opts,review);
    const counts=[await count(client,"asset_version"),await count(client,"scene_revision"),await count(client,"placement")];
    await backfill(client,opts,review);
    assert.deepEqual([await count(client,"asset_version"),await count(client,"scene_revision"),await count(client,"placement")],counts);
    await verify(client,opts,review);
    await client.query("begin isolation level repeatable read");
    try {
      await client.query("update scene set draft_document=jsonb_set(draft_document,'{content,loop}','true') where id=$1",[assets.scene]);
      await assert.rejects(verifySnapshot(client,opts,review),/reviewed fixed-version rewrite/);
    } finally { await client.query("rollback"); }
    await client.query("begin isolation level repeatable read");
    try {
      await client.query("update placement set asset_id=$1,asset_version_id=(select current_version_id from asset where id=$1) where id=(select placement_id from legacy_runtime_binding where public_id=$2 and organization_id=$3)",[assets.model,assets.shop,orgs[0]]);
      await assert.rejects(verifySnapshot(client,opts,review),/final staged version/);
    } finally { await client.query("rollback"); }
    assert.equal((await client.query("select count(*)::int n from scene_revision where scene_id=$1",[assets.draft])).rows[0].n,0);
    assert.equal((await client.query("select count(*)::int n from placement p join legacy_runtime_binding b on b.placement_id=p.id where b.public_id=$1 and p.location is null",[assets.shop])).rows[0].n,1);
    assert.equal((await client.query("select count(*)::int n from placement p join legacy_runtime_binding b on b.placement_id=p.id where b.public_id=$1",[assets.anchor])).rows[0].n,0);
    assert.deepEqual((await client.query("select payload->'migration_legacy'->'metadata'->'dimensions' dimensions from asset_version where asset_id=$1",[assets.model])).rows[0].dimensions,{width:1,height:2,depth:3});
    const after=await audit(client,opts);assert.equal(after.source_fingerprint,review.source_fingerprint,"Shadow split identities must not enter source audit");
    const shadowId=review.mappings.find((mapping)=>mapping.source_id===assets.model)!.targets.find((target)=>target.organization_id===orgs[1])!.target_id;
    assert.ok((await client.query("select 1 from asset where id=$1 and workspace_id='{}' and location is null",[shadowId])).rowCount);
    assert.equal(after.mappings.some((mapping)=>mapping.source_id===shadowId),false,"Audit must exercise content_migration_map shadow exclusion");
    console.log("PASS dry-run rollback, idempotency, split identities, nested metadata, no-GPS shops, anchors, unplaced drafts and source fingerprint stability");
    await client.query("update asset set file_url=$2 where id=$1",[assets.model,`${base}/assets/model-v2.glb`]);
    await assert.rejects(cutover(client,opts,review),/SOURCE_DRIFT/);
    assert.equal((await client.query("select content_model_state from organization where id=$1",[orgs[0]])).rows[0].content_model_state,"readonly");
    await assert.rejects(client.query("update asset set name='stale writer' where id=$1",[assets.model]),/UPGRADE_REQUIRED/);
    review=await reviewed(client,id(2));
    const second={...opts,runId:id(2)};
    await backfill(client,second,review);
    await verify(client,second,review);
    assert.equal(await count(client,"asset_version"),counts[0]+2,"Changed shared model appends one immutable version in each organization");
    assert.equal(await count(client,"scene_revision"),counts[1]+3,"Dependency URL changes append all three published snapshots");
    console.log("PASS dependency drift freezes writes, restaging appends versions/revisions without mutating history");
    await cutover(client,{...second,apply:false},review);
    await cutover(client,second,review);
    await assert.rejects(backfill(client,second,review),/live v2/);
    await assert.rejects(client.query("update asset_version set payload='{}' where asset_id=$1",[assets.model]),/immutable/);
    await rollback(client,{...second,apply:false},review);
    assert.equal((await client.query("select content_model_state from organization where id=$1",[orgs[0]])).rows[0].content_model_state,"v2");
    await rollback(client,second,review);
    assert.equal((await client.query("select content_model_state from organization where id=$1",[orgs[0]])).rows[0].content_model_state,"legacy");
    await backfill(client,second,review);
    const legacyWriter=new Client({connectionString:process.env.DATABASE_URL});await legacyWriter.connect();
    try{
      await legacyWriter.query("begin");await legacyWriter.query("update asset set name=name where id=$1",[assets.model]);
      let completed=false;const activation=cutover(client,second,review).then((r)=>{completed=true;return r;});
      await new Promise((resolve)=>setTimeout(resolve,200));assert.equal(completed,false,"Cutover must drain the in-flight legacy writer");
      await legacyWriter.query("commit");await activation;
    }finally{await legacyWriter.end();}
    await client.query("begin");await client.query("select set_config('content_model.writer','v2',true)");await client.query("update scene set name='V2 new work',lock_version=lock_version+1 where id=$1",[assets.draft]);await client.query("commit");
    await assert.rejects(rollback(client,second,review),/V2_WRITES_DETECTED/);
    assert.equal((await client.query("select name from scene where id=$1",[assets.draft])).rows[0].name,"V2 new work");
    console.log("PASS atomic cutover, old-writer drain, immutable snapshots, safe rollback and refusal after new v2 work");
    console.log("PASS all migration integration checks (dedicated local DB only)");
  }finally{await client.end();}
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
