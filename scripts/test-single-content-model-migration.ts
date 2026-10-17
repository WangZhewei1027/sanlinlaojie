/** End-to-end upgrade fixture. Only a NEW disposable database on the validation container. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { migrateUnversionedContent } from "./migrate/content-model/unify";

const uuid = (n: number) => `17180000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = "https://single-migration.invalid";
async function main() {
  assert.ok(process.env.DATABASE_URL, "explicit test DATABASE_URL required");
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/content_single_migration");
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const upgrade = async () => {
    await client.query("begin");
    try {
      await migrateUnversionedContent(client, base);
      await client.query(readFileSync("db/migrations/20261017180000_single_content_model.sql", "utf8"));
      await client.query("insert into schema_migrations(name) values('20261017180000_single_content_model.sql')");
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; }
  };
  try {
    assert.equal((await client.query("select to_regclass('public.asset') relation")).rows[0].relation, null, "use a new disposable database");
    await client.query(readFileSync("scripts/test-support/pre-single-content-model.sql", "utf8"));
    const orgA = uuid(1), orgB = uuid(2), wsA = uuid(3), wsB = uuid(4), wsC = uuid(5);
    for (const id of [orgA, orgB]) await client.query("insert into organization(id,name) values($1,'team')", [id]);
    for (const [id, org] of [[wsA,orgA],[wsB,orgA],[wsC,orgB]]) await client.query("insert into workspace(id,name,organization_id) values($1,'map',$2)", [id,org]);
    const model = uuid(10), scene = uuid(11), anchor = uuid(12), shop = uuid(13), text = uuid(14), orphan = uuid(15), bad = uuid(16);
    const tagA = uuid(20), tagB = uuid(21);
    for (const [id,ws] of [[tagA,wsA],[tagB,wsB]]) await client.query("insert into tag(id,name,workspace_id) values($1,'tag',$2)", [id,ws]);
    const doc = { schemaVersion: 2, content: { kind: "composition", units: "meters", durationSeconds: null, loop: false,
      assets: { model: { assetId: model } }, instances: [{ id: "model", asset: "model", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1], animation: null }] } };
    for (const [id,kind,workspaces,file,body,metadata] of [
      [model,"model",[wsA,wsB,wsC],`${base}/assets/model.glb`,null,{ dimensions:{ width:2 },height:7 }],
      [scene,"scene",[wsA,wsB,wsC],null,JSON.stringify(doc),{}],
      [anchor,"anchor",[wsA,wsB],`${base}/assets/anchor.jpg`,null,{}],
      [shop,"shop",[wsA],`${base}/assets/shop.jpg`,"shop",{ checkin_url:`${base}/assets/checkin.jpg` }],
      [text,"text",[wsA,wsB],null,"original text",{}],
      [orphan,"image",[],`${base}/assets/orphan.jpg`,null,{}],
      [bad,"scene",[wsA],null,"{broken",{}],
    ] as const) await client.query(`insert into asset(id,name,file_type,workspace_id,file_url,text_content,metadata,location,tag_ids)
      values($1,'source',$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),$7)`, [id,kind,workspaces,file,body,metadata,id===model?[tagA,tagB]:[]]);
    await client.query("insert into content_migration_map(source_kind,source_id,source_row_hash,status,reason) values('asset',$1,'orphan','quarantined','No surviving workspace')", [orphan]);
    await assert.rejects(upgrade, /Cannot migrate/, "invalid unreviewed sources abort the upgrade");
    assert.equal((await client.query("select count(*)::int n from asset_version")).rows[0].n, 0, "no partial version writes survive");
    assert.equal((await client.query("select to_regclass('public.workspace_assignment') relation")).rows[0].relation, "workspace_assignment");
    await client.query("delete from asset where id=$1", [bad]);
    await upgrade();
    assert.equal((await client.query("select count(*)::int n from workspace")).rows[0].n, 3, "workspace IDs are unchanged collections");
    for (const id of [model,scene,text]) {
      const rows = (await client.query(`select p.* from placement p left join scene_revision r on r.id=p.scene_revision_id
        where p.asset_id=$1 or r.scene_id=$1`,[id])).rows;
      assert.ok(rows.some(r=>r.workspace_id===wsA) && rows.some(r=>r.workspace_id===wsB), "shared source creates separate placements");
      assert.equal(new Set(rows.map(r=>r.id)).size, rows.length);
    }
    const models = (await client.query("select * from asset where file_type='model'")).rows;
    assert.equal(models.length, 2, "cross-team content is split into separate owned identities");
    const refs = (await client.query("select r.*,a.organization_id asset_org from scene_asset_ref r join asset a on a.id=r.asset_id")).rows;
    assert.equal(refs.length, 2);
    assert.ok(refs.every(r=>r.organization_id===r.asset_org && r.asset_version_id), "scene references are pinned inside their own team");
    assert.equal((await client.query("select count(*)::int n from placement_tag")).rows[0].n, 2, "collection-specific tags survive");
    const placedModel = (await client.query("select * from placement where asset_id=$1 limit 1",[model])).rows[0];
    assert.deepEqual(placedModel.render_config.display.dimensions, {width:2});
    assert.equal(placedModel.altitude, 7);
    assert.equal((await client.query("select count(*)::int n from placement where asset_id=$1",[anchor])).rows[0].n, 2);
    assert.equal((await client.query("select count(*)::int n from asset_version_resource where role='checkin'")).rows[0].n, 1);
    assert.equal((await client.query("select count(*)::int n from asset_version where payload ? 'migration_legacy'")).rows[0].n, 0);
    assert.equal((await client.query("select count(*)::int n from storage_hold where storage_key='assets/orphan.jpg'")).rows[0].n, 1);
    assert.equal((await client.query("select row_data->>'file_url' url from migration_archive.content_model_source where source_table='asset' and source_key=$1",[orphan])).rows[0].url, `${base}/assets/orphan.jpg`);
    for (const table of ["workspace_assignment","asset_workspace_grant","legacy_runtime_binding","legacy_content_map","content_migration_map"]) {
      assert.equal((await client.query("select to_regclass($1) relation",[`public.${table}`])).rows[0].relation, null);
    }
    assert.equal((await client.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='asset' and column_name in ('workspace_id','file_url','metadata')")).rows[0].n, 0);
    console.log("PASS atomic hard cutover, stable collection IDs, independent placements, tenant splits, pinned scenes, tags, resources and quarantine");
  } finally { await client.end(); }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
