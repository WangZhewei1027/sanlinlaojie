/** Real upgrade from the previous schema. Only a new disposable validation database. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
const id = (n: number) => `18000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname,"127.0.0.1"); assert.equal(url.port,"55439"); assert.equal(url.pathname,"/content_scene_migration");
  const db = new Client({ connectionString: url.toString() }); await db.connect();
  try {
    assert.equal((await db.query("select to_regclass('public.scene') relation")).rows[0].relation,null);
    await db.query(readFileSync("scripts/test-support/pre-mutable-scenes.sql","utf8"));
    await db.query("insert into organization(id,name) values($1,'team')",[id(1)]);
    await db.query("insert into workspace(id,organization_id,name) values($1,$2,'map')",[id(2),id(1)]);
    const saved = { schemaVersion:4,content:{kind:"composition",units:"meters",durationSeconds:23,loop:false,assets:{},instances:[]} };
    const published = { ...saved, content:{...saved.content,durationSeconds:10} };
    await db.query("insert into scene(id,organization_id,name,draft_document,lock_version) values($1,$2,'saved scene',$3,7)",[id(3),id(1),saved]);
    await db.query("insert into scene_revision(id,scene_id,organization_id,revision_no,source_lock_version,name,document) values($1,$2,$3,1,2,'old title',$4)",[id(4),id(3),id(1),published]);
    for (const [n,status] of [[5,'active'],[6,'paused'],[7,'archived']]) await db.query("insert into placement(id,organization_id,workspace_id,name,scene_revision_id,location,render_config,status,lock_version) values($1,$2,$3,'placed',$4,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),$5,$6,9)",[id(Number(n)),id(1),id(2),id(4),{config:{scale:3}},status]);
    const before = (await db.query("select to_jsonb(p)-'scene_revision_id' as value from placement p order by id")).rows;
    const sql = readFileSync("db/migrations/20261018000000_mutable_scenes.sql","utf8");
    // Rollback rehearses an interrupted migration; no half-new schema survives.
    await db.query("begin"); await db.query(sql); await db.query("rollback");
    assert.ok((await db.query("select to_regclass('scene_revision') relation")).rows[0].relation);
    await db.query("begin"); await db.query(sql); await db.query("commit");
    assert.deepEqual((await db.query("select to_jsonb(p)-'scene_id' as value from placement p order by id")).rows,before);
    assert.deepEqual((await db.query("select document from scene where id=$1",[id(3)])).rows[0].document,saved);
    assert.equal((await db.query("select count(*)::int n from placement where scene_id=$1",[id(3)])).rows[0].n,3);
    assert.equal((await db.query("select to_regclass('scene_revision') relation")).rows[0].relation,null);
    assert.equal((await db.query("select to_regclass('scene_revision_asset_ref') relation")).rows[0].relation,null);
    assert.equal((await db.query("select count(*)::int n from migration_archive.mutable_scene_source")).rows[0].n,5);
    await assert.rejects(db.query("insert into placement(organization_id,workspace_id,scene_id) values($1,$2,$3)",[id(1),id(2),id(99)]), (e: {code?:string}) => e.code === '23503');
    await db.query("select purge_organizations(array[$1]::uuid[])",[id(1)]);
    assert.equal((await db.query("select count(*)::int n from scene")).rows[0].n,0);
    console.log("PASS saved scene wins; all placement states/IDs/settings survive; rollback, archive, FK and purge verified");
  } finally { await db.end(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
