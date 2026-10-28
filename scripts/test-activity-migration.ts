/** Real upgrade regression. Only a NEW disposable loopback database is accepted. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { ACTIVITY_MIGRATION, activityMigrationReport, parseActivityReview, prepareActivityMigration, type ActivityTextReview } from "./db/activity-migration";
import { parseActivityConfig } from "../lib/activities/input";
import { ACTIVITY_LOCATION_MIGRATION, prepareActivityOwnedLocationsMigration } from "./db/activity-owned-locations";

const id = (n: number) => `20261028-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function main() {
  assert.ok(process.env.DATABASE_URL, "An explicit test DATABASE_URL is required");
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
  assert.equal(url.username, "postgres"); assert.match(url.pathname, /^\/content_activity_migration(?:_[a-z0-9]+)?$/);
  const db = new Client({ connectionString: url.toString() }); await db.connect();
  const upgrade = async (review: ActivityTextReview[] = []) => {
    if ((await db.query("select 1 from schema_migrations where name=$1", [ACTIVITY_MIGRATION])).rowCount) return;
    await db.query("begin");
    try {
      await prepareActivityMigration(db, review);
      await db.query(readFileSync(`db/migrations/${ACTIVITY_MIGRATION}`, "utf8"));
      await db.query("insert into schema_migrations(name) values($1)", [ACTIVITY_MIGRATION]);
      await db.query("commit");
    } catch (error) { await db.query("rollback"); throw error; }
  };
  try {
    assert.equal((await db.query("select to_regclass('public.asset') relation")).rows[0].relation, null, "Use a fresh isolated database");
    await db.query("begin");
    await db.query(readFileSync("scripts/test-support/pre-activities.sql", "utf8"));
    await db.query("commit");
    for (const n of [1, 2]) await db.query("insert into organization(id,name,config,allowed_file_types) values($1,$2,$3,array['image','text','shop'])",
      [id(n), `team-${n}`, { shop_checkin_enabled: n === 1 }]);
    for (const n of [3, 4, 5, 6]) await db.query("insert into workspace(id,name,organization_id) values($1,$2,$3)",
      [id(n), `map-${n}`, id(n === 5 ? 2 : 1)]);
    const putAsset = async (n: number, type: string, origin: string, workspace = 3, state = "active") => {
      await db.query(`insert into asset(id,organization_id,origin_workspace_id,name,file_type,origin,state,payload,create_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,'2026-09-01T00:00:00Z')`,
      [id(n), id(workspace === 5 ? 2 : 1), id(workspace), `asset-${n}`, type, origin, state,
        { kind: type, ...(type === "text" || type === "shop" ? { text: `内容-${n}` } : {}), ...(type === "shop" ? { name: `店铺-${n}` } : {}) }]);
    };
    const place = async (n: number, asset: number, workspace: number, status = "active", located = true) => {
      await db.query(`insert into placement(id,organization_id,workspace_id,asset_id,status,location,altitude,render_config,created_at)
        values($1,$2,$3,$4,$5,case when $6 then st_setsrid(st_makepoint(121.5,31.2),4326) else null end,8,$7,'2026-09-02T00:00:00Z')`,
      [id(n), id(workspace === 5 ? 2 : 1), id(workspace), id(asset), status, located, { display: { scale: 2 } }]);
    };
    await putAsset(10, "shop", "legacy", 3, "archived");
    await putAsset(11, "shop", "team_upload");
    await putAsset(12, "shop", "legacy");
    await putAsset(13, "shop", "legacy", 5);
    await db.query("insert into asset_resource(asset_id,role,storage_key) values($1,'primary','assets/shop.jpg'),($1,'checkin','assets/reward.jpg')", [id(10)]);
    await db.query("insert into asset_resource(asset_id,role,external_url) values($1,'checkin','https://fixture.invalid/reward.png')", [id(11)]);
    await place(101, 10, 3); await place(102, 10, 4, "paused");
    await place(103, 11, 3, "active", false); await place(104, 13, 5);
    await db.query("insert into tag(id,name,workspace_id) values($1,'shop tag',$2)", [id(301), id(3)]);
    await db.query("insert into placement_tag(placement_id,tag_id,workspace_id) values($1,$2,$3)", [id(101), id(301), id(3)]);
    await putAsset(20, "text", "public_submission");
    await putAsset(21, "text", "public_submission", 6);
    await putAsset(22, "text", "legacy");
    await putAsset(23, "text", "legacy");
    await putAsset(24, "text", "team_upload");
    await putAsset(25, "text", "legacy");
    await place(201, 20, 3); await place(202, 20, 4, "paused");
    await place(203, 22, 3); await place(204, 23, 3); await place(205, 24, 3); await place(206, 25, 3);
    await db.query("insert into content_audit_log(organization_id,action,object_type,object_id,details) values($1,'placement.public_text','placement',$2,$3)",
      [id(1), id(206), { asset_id: id(25), channel: "miniapp" }]);
    const report = await activityMigrationReport(db);
    assert.deepEqual(report.texts.filter((row) => row.classification === "review_required").map((row) => row.assetId), [id(22), id(23)]);
    assert.equal(report.texts.find((row) => row.assetId === id(25))?.classification, "public_submission");
    let review = parseActivityReview({ format: "activity-text-review-v1", assets: report.texts
      .filter((row) => row.classification === "review_required")
      .map((row) => ({ assetId: row.assetId, sourceHash: row.sourceHash, decision: row.assetId === id(22) ? "migrate" : "keep", reason: "Fixture classification evidence" })) });
    await assert.rejects(upgrade(), /requires explicit migrate\/keep review/);
    await assert.rejects(upgrade([{ ...review[0], sourceHash: "0".repeat(64) }, review[1]]), /stale/);
    await db.query("update asset set name='edited after review' where id=$1", [id(22)]);
    await assert.rejects(upgrade(review), /stale/);
    await db.query("update asset set name='asset-22' where id=$1", [id(22)]);
    const freshReport = await activityMigrationReport(db);
    review = review.map((entry) => ({ ...entry, sourceHash: freshReport.texts.find((row) => row.assetId === entry.assetId)!.sourceHash }));
    await db.query("insert into asset_resource(asset_id,role,external_url) values($1,'primary','https://fixture.invalid/unexpected.jpg')", [id(20)]);
    await assert.rejects(upgrade(review), /submitted text has media, scene or anchor references/);
    assert.equal((await db.query("select to_regclass('public.activity') relation")).rows[0].relation, null, "DDL and archive rows roll back together");
    assert.equal((await db.query("select to_regclass('migration_archive.activity_source') relation")).rows[0].relation, null);
    assert.equal((await db.query("select count(*)::int n from placement")).rows[0].n, 10);
    await db.query("delete from asset_resource where asset_id=$1", [id(20)]);
    await upgrade(review); await upgrade(review);

    // Migrated rows must satisfy the actual management DTO parser, not merely
    // the database's broad JSON-object constraint. Provenance belongs in the archive.
    const placementConfigs = (await db.query<{ type: string; config: unknown }>(
      "select a.type,p.config from activity_placement p join activity a on a.id=p.activity_id",
    )).rows;
    assert.ok(placementConfigs.length > 0);
    for (const row of placementConfigs) {
      assert.ok(row.type === "shop_checkin" || row.type === "danmaku");
      assert.deepEqual(parseActivityConfig(row.config, row.type), {});
    }
    assert.equal((await db.query("select count(*)::int n from activity where type='shop_checkin'")).rows[0].n, 4);
    assert.equal((await db.query("select count(*)::int n from activity_point")).rows[0].n, 5);
    assert.equal((await db.query("select count(*)::int n from activity where type='danmaku'")).rows[0].n, 3);
    assert.deepEqual((await db.query("select id from activity_point_placement order by id")).rows.map((row) => row.id), [101, 102, 103, 104].map(id));
    const point = (await db.query("select * from activity_point_placement where id=$1", [id(101)])).rows[0];
    const shared = (await db.query("select * from activity_point_placement where id=$1", [id(102)])).rows[0];
    assert.equal(point.enabled, true); assert.equal(shared.enabled, false);
    assert.deepEqual(point.config.tagIds, [id(301)]); assert.equal(point.config.altitude, 8);
    assert.deepEqual(point.config.renderConfig, { display: { scale: 2 } });
    assert.equal((await db.query("select location from activity_point_placement where id=$1", [id(103)])).rows[0].location, null);
    const disabled = (await db.query("select p.status from activity_placement p join activity a on a.id=p.activity_id where p.workspace_id=$1 and a.type='shop_checkin'", [id(5)])).rows[0];
    assert.equal(disabled.status, "paused", "Respect the original team shop toggle");
    const reward = (await db.query("select p.reward_asset_id from activity_point p where p.image_asset_id=$1", [id(10)])).rows;
    assert.equal(reward.length, 2); assert.equal(reward[0].reward_asset_id, reward[1].reward_asset_id);
    assert.equal((await db.query("select file_type from asset where id=$1", [id(10)])).rows[0].file_type, "image");
    assert.deepEqual((await db.query("select role,storage_key from asset_resource where asset_id=$1", [reward[0].reward_asset_id])).rows, [{ role: "primary", storage_key: "assets/reward.jpg" }]);
    assert.equal((await db.query("select count(*)::int n from asset where file_type='shop'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from asset_resource where role='checkin'")).rows[0].n, 0);
    assert.deepEqual((await db.query("select id from activity_record order by id")).rows.map((row) => row.id), [21, 201, 202, 203, 206].map(id));
    assert.equal((await db.query("select status from activity_record where id=$1", [id(202)])).rows[0].status, "hidden");
    assert.equal((await db.query("select status from activity_record where id=$1", [id(21)])).rows[0].status, "hidden");
    assert.equal((await db.query("select content from activity_record where id=$1", [id(201)])).rows[0].content, "内容-20");
    assert.equal((await db.query("select created_at from activity_record where id=$1", [id(201)])).rows[0].created_at.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.deepEqual((await db.query("select id from asset where file_type='text' order by id")).rows.map((row) => row.id), [id(23), id(24)]);
    assert.deepEqual((await db.query("select id from placement order by id")).rows.map((row) => row.id), [id(204), id(205)]);
    assert.equal((await db.query("select count(*)::int n from migration_archive.activity_source where source_table='asset'")).rows[0].n, 8);
    assert.equal((await db.query("select count(*)::int n from migration_archive.activity_text_review where decision='keep'")).rows[0].n, 1);
    assert.deepEqual((await db.query("select storage_key from storage_hold order by storage_key")).rows.map((row) => row.storage_key), ["assets/reward.jpg", "assets/shop.jpg"]);
    assert.deepEqual((await db.query("select id from workspace order by id")).rows.map((row) => row.id), [3, 4, 5, 6].map(id));
    assert.equal((await db.query("select count(*)::int n from organization where 'shop'=any(allowed_file_types)")).rows[0].n, 0);

    // Database invariants hold even when a caller bypasses the service layer.
    await assert.rejects(db.query("insert into activity_placement(activity_id,organization_id,workspace_id) values($1,$2,$3)",
      [point.activity_id, id(1), id(5)]), { code: "23503" });
    await assert.rejects(db.query("insert into activity_point_placement(placement_id,activity_id,organization_id,point_id) values($1,$2,$3,$4)",
      [point.placement_id, point.activity_id, id(1), shared.point_id]), { code: "23503" });
    const writeCheckin = (key: string) => db.query(`insert into activity_record(organization_id,activity_id,placement_id,point_id,participant_id,kind,idempotency_key)
      values($1,$2,$3,$4,'device-fixture','checkin',$5)`, [id(1), point.activity_id, point.placement_id, point.point_id, key]);
    await writeCheckin("request-0001");
    await assert.rejects(writeCheckin("request-0001"), { code: "23505" });
    await assert.rejects(writeCheckin("request-0002"), { code: "23505" });
    await assert.rejects(db.query("delete from activity_point where id=$1", [point.point_id]), { code: "23503" });
    await db.query("update activity_point set state='archived' where id=$1", [point.point_id]);
    assert.equal((await db.query("select count(*)::int n from activity_record where point_id=$1", [point.point_id])).rows[0].n, 1);
    // Upgrade the original asset-era fixture through the newest model as well.
    const recordsBefore = (await db.query("select to_jsonb(r) row from activity_record r order by id")).rows;
    const resourcesBefore = (await db.query("select to_jsonb(r) row from asset_resource r order by asset_id,role,ordinal")).rows;
    await db.query("begin");
    await prepareActivityOwnedLocationsMigration(db);
    await db.query(readFileSync(`db/migrations/${ACTIVITY_LOCATION_MIGRATION}`, "utf8"));
    await db.query("insert into schema_migrations(name) values($1)", [ACTIVITY_LOCATION_MIGRATION]);
    await db.query("commit");
    assert.equal((await db.query("select to_regclass('public.activity_point_placement') relation")).rows[0].relation, null);
    assert.equal((await db.query("select location from activity_point where id=$1", [point.point_id])).rows[0].location, point.location);
    assert.equal((await db.query("select state from activity_point where id=$1", [shared.point_id])).rows[0].state, "archived");
    assert.deepEqual((await db.query("select to_jsonb(r) row from activity_record r order by id")).rows, recordsBefore);
    assert.deepEqual((await db.query("select to_jsonb(r) row from asset_resource r order by asset_id,role,ordinal")).rows, resourcesBefore);
    assert.equal((await db.query("select row_data from migration_archive.activity_location_source where source_table='activity_point_placement' and source_key=$1", [id(101)])).rows[0].row_data.config.altitude, 8);
    await db.query("select purge_organizations($1::uuid[])", [[id(1), id(2)]]);
    assert.equal((await db.query("select count(*)::int n from activity_record")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from activity")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from migration_archive.activity_source")).rows[0].n > 0, true, "Source archive survives explicit tenant purge");
    console.log("PASS activity upgrade: reviewed provenance, stale/missing review rejection, atomic rollback, multi-point grouping, stable old IDs, status/media preservation, independent records, fixed activity locations, FK isolation, idempotency, archive retention and replay");
  } finally { await db.end(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
