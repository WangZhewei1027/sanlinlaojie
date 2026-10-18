/** Disposable, real PostgreSQL fixtures for content service integration tests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SceneDocumentJson } from "../lib/content-model/contracts";

/** Dedicated databases on the loopback validation container; never the 55432 development database. */
export const SERVICES_DATABASES = ["content_services", "team_wb_services", "content_mutable"] as const;

export function assertServicesDatabase(): void {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be explicit; this test never loads .env");
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.ok((SERVICES_DATABASES as readonly string[]).includes(url.pathname.slice(1)), `Only the dedicated ${SERVICES_DATABASES.join(" / ")} databases are permitted`);
  assert.equal(url.username, "postgres");
  for (const name of ["OSS_BUCKET", "OSS_REGION", "ALIBABA_CLOUD_ACCESS_KEY_ID", "ALIBABA_CLOUD_ACCESS_KEY_SECRET"]) delete process.env[name];
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://content-services.invalid";
  globalThis.fetch = async () => { throw new Error("External fetch is forbidden in content service tests"); };
}

export function assetDocument(assetId: string): SceneDocumentJson {
  return { schemaVersion: 4, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false,
    assets: { model: { assetId } }, instances: [{ id: "model-instance", asset: "model",
      position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null }] } };
}

export function fixtureIds() {
  const run = randomUUID();
  return {
    run,
    users: { owner: randomUUID(), maintainer: randomUUID(), editor: randomUUID(), viewer: randomUUID(), foreign: randomUUID(), unassigned: randomUUID(), manager: randomUUID() },
    // solo: a v2 team with zero collections (team authoring needs no workspace)
    organizations: { team: randomUUID(), foreign: randomUUID(), solo: randomUUID() },
    workspaces: { a: randomUUID(), b: randomUUID(), secret: randomUUID(), empty: randomUUID(), foreign: randomUUID() },
    assets: { shared: randomUUID(), restricted: randomUUID(), foreign: randomUUID(), audio: randomUUID(), shop: randomUUID() },
    scenes: { a: randomUUID(), b: randomUUID(), secret: randomUUID() },
    placements: { first: randomUUID(), second: randomUUID(), scene: randomUUID() },
    receipts: { active: randomUUID(), expired: randomUUID() },
    keys: { shared: `assets/${run}/shared.glb`, current: `assets/${run}/current.glb`, restricted: `assets/${run}/restricted.glb`,
      audio: `assets/${run}/audio.webm`, checkin: `assets/${run}/checkin.jpg`, lease: `assets/${run}/lease.glb`, expired: `assets/${run}/expired.glb`,
      missing: `assets/${run}/missing.glb`, concurrentAudio: `assets/${run}/concurrent.webm` },
  };
}

export type ServicesFixture = ReturnType<typeof fixtureIds>;

/** Represent frozen migrated content without going through the new-input validator. */
export async function seedRuntimeProjectionFixture(client: Client, f: ServicesFixture, input: {
  kind: string;
  payload: Record<string, unknown>;
  resources?: { role: string; url?: string; storageKey?: string; contentHash?: string }[];
  renderConfig?: Record<string, unknown>;
  location?: boolean;
  anchorId?: string;
}) {
  const ids = { asset: randomUUID(), placement: randomUUID(), public: "" };
  ids.public = ids.placement;
  await client.query("begin");
  try {
    await client.query("select set_config('content_model.writer','content',true)");
    await client.query(`insert into asset(id,name,file_type,organization_id,origin_workspace_id,maintained_by,visibility,origin,payload)
      values($1,'runtime migrated fixture',$2,$3,$4,$5,'restricted','legacy',$6)`,
    [ids.asset, input.kind, f.organizations.team, f.workspaces.a, f.users.maintainer, input.payload]);
    for (const resource of input.resources ?? []) {
      await client.query("insert into asset_resource(asset_id,role,external_url,storage_key,content_hash) values($1,$2,$3,$4,$5)",
        [ids.asset, resource.role, resource.url ?? null, resource.storageKey ?? null, resource.contentHash ?? null]);
    }
    await client.query(`insert into placement(id,organization_id,workspace_id,name,asset_id,location,anchor_id,render_config,status)
      values($1,$2,$3,'runtime migrated placement',$4,case when $5 then ST_SetSRID(ST_MakePoint(121.5,31.2),4326) else null end,$6,$7,'active')`,
    [ids.placement, f.organizations.team, f.workspaces.a, ids.asset, input.location ?? true, input.anchorId ?? null, input.renderConfig ?? {}]);
    await client.query("commit");
    return ids;
  } catch (error) { await client.query("rollback"); throw error; }
}

export async function seedServicesFixture(client: Client, f: ServicesFixture): Promise<void> {
  assert.ok((SERVICES_DATABASES as readonly string[]).includes((await client.query("select current_database() database")).rows[0].database));
  assert.ok((await client.query("select to_regclass('public.asset_resource') relation")).rows[0].relation);
  await client.query("begin");
  try {
    await client.query("select set_config('content_model.writer','content',true)");
    for (const [name, id] of Object.entries(f.users)) {
      await client.query("insert into auth.users(id,name,email) values($1,$2,$3)", [id, `service-test-${name}`, `${f.run}-${name}@example.test`]);
    }
    for (const [name, id] of Object.entries(f.organizations)) {
      await client.query("insert into organization(id,name) values($1,$2)", [id, `service-test-${name}-${f.run}`]);
    }
    for (const [name, id] of Object.entries(f.workspaces)) {
      await client.query("insert into workspace(id,name,organization_id) values($1,$2,$3)", [id, `service-test-${name}`, name === "foreign" ? f.organizations.foreign : f.organizations.team]);
    }
    for (const [name, id] of Object.entries(f.users)) {
      await client.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3)",
        [name === "foreign" ? f.organizations.foreign : f.organizations.team, id, name === "owner" || name === "foreign" ? "owner" : name === "viewer" ? "viewer" : "member"]);
    }
    for (const [user, role] of [[f.users.owner, "owner"], [f.users.unassigned, "member"], [f.users.viewer, "viewer"]]) {
      await client.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3)", [f.organizations.solo, user, role]);
    }
    for (const [name, id] of Object.entries(f.assets)) {
      const foreign = name === "foreign";
      const type = name === "audio" || name === "shop" ? name : "model";
      await client.query(`insert into asset(id,name,file_type,organization_id,origin_workspace_id,maintained_by,created_by,visibility,origin,payload)
        values($1,$2,$3,$4,$5,$6,$6,$7,'team_upload',jsonb_build_object('kind',$3::text))`,
      [id, `service-test-${name}`, type, foreign ? f.organizations.foreign : f.organizations.team,
        foreign ? f.workspaces.foreign : f.workspaces.a, foreign ? f.users.foreign : f.users.maintainer,
        name === "restricted" ? "restricted" : "organization"]);
    }
    for (const [name, asset] of Object.entries(f.assets)) {
      const kind = name === "audio" || name === "shop" ? name : "model";
      const key = name === "shared" ? f.keys.current : name === "foreign" ? f.keys.shared : name === "restricted" ? f.keys.restricted : name === "audio" ? f.keys.audio : null;
      await client.query("update asset set payload=$2 where id=$1", [asset, kind === "model" ? {kind, animations:[{index:0,name:"idle",duration_seconds:2}]} : {kind}]);
      if (key) await client.query("insert into asset_resource(asset_id,role,storage_key,content_hash,mime_type,size_bytes) values($1,'primary',$2,$3,$4,128)",
        [asset,key,`hash-${asset}`,kind === "audio" ? "audio/webm" : "model/gltf-binary"]);
    }
    await client.query("insert into asset_resource(asset_id,role,storage_key) values($1,'checkin',$2)", [f.assets.shop, f.keys.checkin]);
    const document = JSON.stringify(assetDocument(f.assets.shared));
    for (const [name, id] of Object.entries(f.scenes)) {
      const workspace = f.workspaces[name as keyof typeof f.scenes];
      await client.query("insert into scene(id,organization_id,workspace_id,name,document,created_by) values($1,$2,$3,$4,$5::jsonb,$6)",
        [id, f.organizations.team, workspace, `service-test-${name}-private-draft`, document, f.users.maintainer]);
      await client.query("insert into scene_asset_ref(scene_id,organization_id,resource_alias,asset_id) values($1,$2,'model',$3)",
        [id, f.organizations.team, f.assets.shared]);
    }
    for (const id of [f.placements.first, f.placements.second]) {
      await client.query(`insert into placement(id,organization_id,workspace_id,name,asset_id,location,status)
        values($1,$2,$3,'direct',$4,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),'active')`,
      [id, f.organizations.team, f.workspaces.b, f.assets.shared]);
    }
    await client.query(`insert into placement(id,organization_id,workspace_id,name,scene_id,location,status)
      values($1,$2,$3,'scene',$4,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),'active')`,
    [f.placements.scene, f.organizations.team, f.workspaces.a, f.scenes.a]);
    for (const [name, id] of Object.entries(f.receipts)) {
      await client.query(`insert into upload_receipt(id,organization_id,workspace_id,created_by,storage_key,content_hash,size_bytes,purpose,expires_at)
        values($1,$2,$3,$4,$5,$6,128,$7,now()+$8::interval)`,
      [id, f.organizations.team, f.workspaces.a, f.users.maintainer, name === "expired" ? f.keys.expired : f.keys.lease,
        `receipt-${id}`, "asset", name === "expired" ? "-1 hour" : "1 hour"]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
}

/** Remove only this run's tenants and sign-up bootstrap rows, never reset the database. */
export async function cleanupServicesFixture(client: Client, f: ServicesFixture): Promise<void> {
  await client.query("begin");
  try {
    await client.query("select set_config('content_model.writer','purge',true)");
    const users = Object.values(f.users);
    const organizations = [...Object.values(f.organizations), ...(await client.query<{ id: string }>(
      "select id from organization where created_by=any($1::uuid[])", [users])).rows.map((row) => row.id)];
    const workspaces = (await client.query<{ id: string }>("select id from workspace where organization_id=any($1::uuid[])", [organizations])).rows.map((row) => row.id);
    await client.query("delete from placement_tag where workspace_id=any($1::uuid[])", [workspaces]);
    for (const table of ["placement", "scene_asset_ref", "scene"]) {
      await client.query(`delete from ${table} where organization_id=any($1::uuid[])`, [organizations]);
    }
    await client.query("delete from asset where organization_id=any($1::uuid[])", [organizations]);
    for (const table of ["upload_receipt", "content_command_idempotency", "content_audit_log", "organization_invitation"]) {
      await client.query(`delete from ${table} where organization_id=any($1::uuid[])`, [organizations]);
    }
    await client.query("delete from workspace where id=any($1::uuid[])", [workspaces]);
    await client.query("delete from organization where id=any($1::uuid[])", [organizations]);
    await client.query("delete from auth.users where id=any($1::uuid[])", [users]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
}
