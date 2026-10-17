/** Upgrade regression: only a NEW disposable database on the validation container. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const id = (n: number) => `17220000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const migration = "20261017220000_mutable_assets.sql";
async function main() {
  assert.ok(process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname,"127.0.0.1"); assert.equal(url.port,"55439");
  assert.equal(url.pathname,"/content_mutable_migration");
  const db = new Client({connectionString:url.toString()}); await db.connect();
  const upgrade = async () => {
    if ((await db.query("select 1 from schema_migrations where name=$1",[migration])).rowCount) return;
    await db.query("begin");
    try {
      await db.query(readFileSync(`db/migrations/${migration}`,"utf8"));
      await db.query("insert into schema_migrations(name) values($1)",[migration]);
      await db.query("commit");
    } catch (error) { await db.query("rollback"); throw error; }
  };
  try {
    assert.equal((await db.query("select to_regclass('public.asset') relation")).rows[0].relation,null,"use a new test database");
    await db.query(readFileSync("scripts/test-support/pre-mutable-assets.sql","utf8"));
    await db.query("insert into organization(id,name) values($1,'team')",[id(1)]);
    for (const n of [2,3]) await db.query("insert into workspace(id,organization_id,name) values($1,$2,'collection')",[id(n),id(1)]);
    for (const [asset,kind,old,current] of [[10,"model",11,12],[20,"anchor",21,22]] as const) {
      await db.query("insert into asset(id,organization_id,file_type) values($1,$2,$3)",[id(asset),id(1),kind]);
      for (const [version,no] of [[old,1],[current,2]]) {
        await db.query("insert into asset_version(id,asset_id,organization_id,version_no,payload) values($1,$2,$3,$4,$5)",[id(version),id(asset),id(1),no,{kind,attributes:{label:`content-${no}`}}]);
        await db.query("insert into asset_version_resource(asset_version_id,role,storage_key) values($1,$2,$3)",[id(version),kind==="anchor"?"reference":"primary",`assets/${version}.bin`]);
      }
      await db.query("update asset set current_version_id=$2 where id=$1",[id(asset),id(current)]);
      for (const [placement,workspace,version] of [[asset+100,2,old],[asset+101,3,current]])
        await db.query("insert into placement(id,organization_id,workspace_id,asset_id,asset_version_id,status) values($1,$2,$3,$4,$5,'draft')",[id(placement),id(1),id(workspace),id(asset),id(version)]);
    }
    const document = {schemaVersion:3,content:{kind:"composition",units:"meters",durationSeconds:10,loop:false,assets:{model:{assetId:id(10),assetVersionId:id(11)}},instances:[]}};
    await db.query("insert into scene(id,organization_id,name,draft_document) values($1,$2,'layout',$3)",[id(30),id(1),document]);
    await db.query("insert into scene_revision(id,scene_id,organization_id,revision_no,source_lock_version,name,document) values($1,$2,$3,1,1,'layout',$4)",[id(31),id(30),id(1),document]);
    await db.query("insert into scene_asset_ref(scene_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,'model',$3,$4)",[id(30),id(1),id(10),id(11)]);
    await db.query("insert into scene_revision_asset_ref(scene_revision_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,'model',$3,$4)",[id(31),id(1),id(10),id(11)]);
    for (const n of [21,22]) await db.query("insert into anchor_embedding(anchor_id,asset_version_id,image_url,status,generation) values($1,$2,$3,'pending',gen_random_uuid())",[id(20),id(n),`https://fixture.invalid/assets/${n}.bin`]);
    // Invalid current pointers fail atomically before any new model is visible.
    await db.query("update asset set current_version_id=null where id=$1",[id(10)]);
    await assert.rejects(upgrade,/valid current version/);
    assert.equal((await db.query("select to_regclass('public.asset_resource') relation")).rows[0].relation,null);
    assert.equal((await db.query("select count(*)::int n from asset_version")).rows[0].n,4);
    await db.query("update asset set current_version_id=$2 where id=$1",[id(10),id(12)]);
    await upgrade(); await upgrade();
    assert.equal((await db.query("select count(*)::int n from workspace")).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from placement")).rows[0].n,4);
    assert.equal((await db.query("select payload->'attributes'->>'label' value from asset where id=$1",[id(10)])).rows[0].value,"content-2");
    assert.deepEqual((await db.query("select storage_key from asset_resource order by storage_key")).rows.map(r=>r.storage_key),["assets/12.bin","assets/22.bin"]);
    assert.deepEqual((await db.query("select storage_key from storage_hold order by storage_key")).rows.map(r=>r.storage_key),["assets/11.bin","assets/21.bin"]);
    for (const [table,column] of [["scene","draft_document"],["scene_revision","document"]]) {
      const value=(await db.query(`select ${column} document from ${table}`)).rows[0].document;
      assert.equal(value.schemaVersion,4); assert.deepEqual(value.content.assets.model,{assetId:id(10)});
    }
    assert.equal((await db.query("select count(*)::int n from anchor_embedding")).rows[0].n,1);
    assert.equal((await db.query("select status from anchor_embedding")).rows[0].status,"failed");
    assert.equal((await db.query("select count(*)::int n from migration_archive.mutable_asset_source where source_table='asset_version'")).rows[0].n,4);
    for (const table of ["asset_version","asset_version_resource"]) assert.equal((await db.query("select to_regclass($1) relation",[`public.${table}`])).rows[0].relation,null);
    assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and column_name in ('asset_version_id','current_version_id')")).rows[0].n,0);
    await assert.rejects(()=>db.query("update asset set payload='{}' where id=$1",[id(10)]),{code:"23514"});
    console.log("PASS atomic mutable-asset migration, current content selection, live aliases, stable collections/placements, feature invalidation, archive/holds and replay");
  } finally { await db.end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
