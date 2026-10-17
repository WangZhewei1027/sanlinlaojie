/** Disposable, real PostgreSQL fixtures for content service integration tests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SceneDocumentV3Json } from "../lib/content-model/contracts";

export function assertServicesDatabase(): void {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be explicit; this test never loads .env");
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/content_services", "Only the dedicated content_services database is permitted");
  assert.equal(url.username, "postgres");
  for (const name of ["OSS_BUCKET", "OSS_REGION", "ALIBABA_CLOUD_ACCESS_KEY_ID", "ALIBABA_CLOUD_ACCESS_KEY_SECRET"]) delete process.env[name];
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://content-services.invalid";
  globalThis.fetch = async () => { throw new Error("External fetch is forbidden in content service tests"); };
}

export function versionedDocument(assetId: string, versionId: string): SceneDocumentV3Json {
  return { schemaVersion: 3, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false,
    assets: { model: { assetId, assetVersionId: versionId } }, instances: [{ id: "model-instance", asset: "model",
      position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null }] } };
}

export function fixtureIds() {
  const run = randomUUID();
  return {
    run,
    users: { owner: randomUUID(), maintainer: randomUUID(), editor: randomUUID(), viewer: randomUUID(), foreign: randomUUID(), unassigned: randomUUID(), manager: randomUUID() },
    organizations: { team: randomUUID(), foreign: randomUUID() },
    workspaces: { a: randomUUID(), b: randomUUID(), secret: randomUUID(), empty: randomUUID(), foreign: randomUUID() },
    assets: { shared: randomUUID(), restricted: randomUUID(), foreign: randomUUID(), audio: randomUUID(), shop: randomUUID() },
    versions: { shared1: randomUUID(), shared2: randomUUID(), restricted: randomUUID(), foreign: randomUUID(), audio: randomUUID(), shop: randomUUID() },
    scenes: { a: randomUUID(), b: randomUUID(), secret: randomUUID() },
    revisions: { a: randomUUID(), secret: randomUUID() },
    placements: { first: randomUUID(), second: randomUUID(), scene: randomUUID() },
    receipts: { active: randomUUID(), expired: randomUUID(), wrongPurpose: randomUUID() },
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
  sharedWithB?: boolean;
}) {
  const ids = { asset: randomUUID(), version: randomUUID(), placement: randomUUID(), public: randomUUID(), binding: randomUUID() };
  await client.query("begin");
  try {
    await client.query("select set_config('content_model.writer','v2',true)");
    await client.query(`insert into asset(id,name,file_type,organization_id,origin_workspace_id,maintained_by,visibility,origin)
      values($1,'runtime migrated fixture',$2,$3,$4,$5,'restricted','legacy')`,
    [ids.asset, input.kind, f.organizations.team, f.workspaces.a, f.users.maintainer]);
    await client.query("insert into asset_version(id,asset_id,organization_id,version_no,payload) values($1,$2,$3,1,$4)",
      [ids.version, ids.asset, f.organizations.team, input.payload]);
    for (const resource of input.resources ?? []) {
      await client.query("insert into asset_version_resource(asset_version_id,role,external_url,storage_key,content_hash) values($1,$2,$3,$4,$5)",
        [ids.version, resource.role, resource.url ?? null, resource.storageKey ?? null, resource.contentHash ?? null]);
    }
    await client.query("update asset set current_version_id=$1 where id=$2", [ids.version, ids.asset]);
    await client.query(`insert into placement(id,organization_id,workspace_id,name,asset_id,asset_version_id,location,anchor_id,render_config,status)
      values($1,$2,$3,'runtime migrated placement',$4,$5,case when $6 then ST_SetSRID(ST_MakePoint(121.5,31.2),4326) else null end,$7,$8,'active')`,
    [ids.placement, f.organizations.team, f.workspaces.a, ids.asset, ids.version, input.location ?? true, input.anchorId ?? null, input.renderConfig ?? {}]);
    await client.query("insert into legacy_runtime_binding(id,organization_id,public_id,placement_id) values($1,$2,$3,$4)",
      [ids.binding, f.organizations.team, ids.public, ids.placement]);
    for (const workspaceId of [f.workspaces.a, ...(input.sharedWithB ? [f.workspaces.b] : [])]) {
      await client.query("insert into legacy_content_map(binding_id,organization_id,public_id,workspace_id) values($1,$2,$3,$4)",
        [ids.binding, f.organizations.team, ids.public, workspaceId]);
    }
    await client.query("commit");
    return ids;
  } catch (error) { await client.query("rollback"); throw error; }
}

export async function seedServicesFixture(client: Client, f: ServicesFixture): Promise<void> {
  assert.equal((await client.query("select current_database() database")).rows[0].database, "content_services");
  assert.ok((await client.query("select to_regclass('public.asset_version') relation")).rows[0].relation);
  await client.query("begin");
  try {
    await client.query("select set_config('content_model.writer','v2',true)");
    for (const [name, id] of Object.entries(f.users)) {
      await client.query("insert into auth.users(id,name,email) values($1,$2,$3)", [id, `service-test-${name}`, `${f.run}-${name}@example.test`]);
    }
    for (const [name, id] of Object.entries(f.organizations)) {
      await client.query("insert into organization(id,name,content_model_state) values($1,$2,'v2')", [id, `service-test-${name}-${f.run}`]);
    }
    for (const [name, id] of Object.entries(f.workspaces)) {
      await client.query("insert into workspace(id,name,organization_id) values($1,$2,$3)", [id, `service-test-${name}`, name === "foreign" ? f.organizations.foreign : f.organizations.team]);
    }
    for (const [name, id] of Object.entries(f.users)) {
      await client.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3)",
        [name === "foreign" ? f.organizations.foreign : f.organizations.team, id, name === "owner" || name === "foreign" ? "owner" : name === "viewer" ? "viewer" : "member"]);
    }
    for (const [user, workspace, role] of [
      [f.users.maintainer, f.workspaces.a, "editor"], [f.users.maintainer, f.workspaces.empty, "editor"],
      [f.users.editor, f.workspaces.b, "editor"], [f.users.editor, f.workspaces.empty, "editor"], [f.users.viewer, f.workspaces.b, "editor"],
      [f.users.manager, f.workspaces.b, "manager"],
    ]) await client.query("insert into workspace_assignment(user_id,workspace_id,role) values($1,$2,$3)", [user, workspace, role]);
    for (const [name, id] of Object.entries(f.assets)) {
      const foreign = name === "foreign";
      const type = name === "audio" || name === "shop" ? name : "model";
      await client.query(`insert into asset(id,name,file_type,organization_id,origin_workspace_id,maintained_by,created_by,visibility,origin,metadata)
        values($1,$2,$3,$4,$5,$6,$6,$7,'team_upload',$8::jsonb)`,
      [id, `service-test-${name}`, type, foreign ? f.organizations.foreign : f.organizations.team,
        foreign ? f.workspaces.foreign : f.workspaces.a, foreign ? f.users.foreign : f.users.maintainer,
        name === "restricted" ? "restricted" : "organization",
        JSON.stringify(name === "shop" ? { checkin_url: `https://content-services.invalid/${f.keys.checkin}` } : {})]);
    }
    const rows = [
      [f.versions.shared1, f.assets.shared, f.organizations.team, 1, "model", f.keys.shared],
      [f.versions.shared2, f.assets.shared, f.organizations.team, 2, "model", f.keys.current],
      [f.versions.restricted, f.assets.restricted, f.organizations.team, 1, "model", f.keys.restricted],
      [f.versions.foreign, f.assets.foreign, f.organizations.foreign, 1, "model", f.keys.shared],
      [f.versions.audio, f.assets.audio, f.organizations.team, 1, "audio", f.keys.audio],
      [f.versions.shop, f.assets.shop, f.organizations.team, 1, "shop", null],
    ] as const;
    for (const [id, asset, organization, no, kind, key] of rows) {
      await client.query("insert into asset_version(id,asset_id,organization_id,version_no,payload,created_by) values($1,$2,$3,$4,$5::jsonb,$6)",
        [id, asset, organization, no, JSON.stringify(kind === "model" ? { kind, animations: [{ index: 0, name: "idle", duration_seconds: 2 }] } : { kind }), f.users.maintainer]);
      if (key) await client.query("insert into asset_version_resource(asset_version_id,role,storage_key,content_hash,mime_type,size_bytes) values($1,'primary',$2,$3,$4,128)",
        [id, key, `hash-${id}`, kind === "audio" ? "audio/webm" : "model/gltf-binary"]);
      await client.query("update asset set current_version_id=$1 where id=$2", [id, asset]);
    }
    for (const [asset, workspace] of [
      [f.assets.shared, f.workspaces.a], [f.assets.shared, f.workspaces.b], [f.assets.shared, f.workspaces.secret],
      [f.assets.restricted, f.workspaces.a], [f.assets.restricted, f.workspaces.b],
    ]) await client.query("insert into asset_workspace_grant(asset_id,workspace_id,organization_id,created_by) values($1,$2,$3,$4)",
      [asset, workspace, f.organizations.team, f.users.maintainer]);
    const document = JSON.stringify(versionedDocument(f.assets.shared, f.versions.shared1));
    for (const [name, id] of Object.entries(f.scenes)) {
      const workspace = f.workspaces[name as keyof typeof f.scenes];
      await client.query("insert into scene(id,organization_id,workspace_id,name,draft_document,created_by) values($1,$2,$3,$4,$5::jsonb,$6)",
        [id, f.organizations.team, workspace, `service-test-${name}-private-draft`, document, f.users.maintainer]);
      await client.query("insert into scene_asset_ref(scene_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,'model',$3,$4)",
        [id, f.organizations.team, f.assets.shared, f.versions.shared1]);
    }
    for (const [name, id] of Object.entries(f.revisions)) {
      const scene = f.scenes[name as keyof typeof f.revisions];
      await client.query("insert into scene_revision(id,scene_id,organization_id,revision_no,source_lock_version,name,document) values($1,$2,$3,1,1,$4,$5::jsonb)",
        [id, scene, f.organizations.team, `service-test-${name}-published`, document]);
      await client.query("insert into scene_revision_asset_ref(scene_revision_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,'model',$3,$4)",
        [id, f.organizations.team, f.assets.shared, f.versions.shared1]);
    }
    for (const id of [f.placements.first, f.placements.second]) {
      await client.query(`insert into placement(id,organization_id,workspace_id,name,asset_id,asset_version_id,location,status)
        values($1,$2,$3,'direct',$4,$5,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),'active')`,
      [id, f.organizations.team, f.workspaces.b, f.assets.shared, f.versions.shared1]);
    }
    await client.query(`insert into placement(id,organization_id,workspace_id,name,scene_revision_id,location,status)
      values($1,$2,$3,'scene',$4,ST_SetSRID(ST_MakePoint(121.5,31.2),4326),'active')`,
    [f.placements.scene, f.organizations.team, f.workspaces.a, f.revisions.a]);
    for (const [name, id] of Object.entries(f.receipts)) {
      await client.query(`insert into upload_receipt(id,organization_id,workspace_id,created_by,storage_key,content_hash,size_bytes,purpose,expires_at)
        values($1,$2,$3,$4,$5,$6,128,$7,now()+$8::interval)`,
      [id, f.organizations.team, f.workspaces.a, f.users.maintainer, name === "expired" ? f.keys.expired : f.keys.lease,
        `receipt-${id}`, name === "wrongPurpose" ? "anchor_reference" : "asset_version", name === "expired" ? "-1 hour" : "1 hour"]);
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
    const organizations = [f.organizations.team, f.organizations.foreign, ...(await client.query<{ id: string }>(
      "select id from organization where created_by=any($1::uuid[])", [users])).rows.map((row) => row.id)];
    const workspaces = (await client.query<{ id: string }>("select id from workspace where organization_id=any($1::uuid[])", [organizations])).rows.map((row) => row.id);
    for (const table of ["legacy_content_map", "legacy_runtime_binding"]) await client.query(`delete from ${table} where organization_id=any($1::uuid[])`, [organizations]);
    await client.query("delete from placement_tag where workspace_id=any($1::uuid[])", [workspaces]);
    for (const table of ["placement", "scene_asset_ref", "scene_revision_asset_ref", "scene_revision", "scene", "asset_workspace_grant"]) {
      await client.query(`delete from ${table} where organization_id=any($1::uuid[])`, [organizations]);
    }
    await client.query("delete from asset_version_resource where asset_version_id in(select id from asset_version where organization_id=any($1::uuid[]))", [organizations]);
    await client.query("update asset set current_version_id=null where organization_id=any($1::uuid[])", [organizations]);
    await client.query("delete from asset_version where organization_id=any($1::uuid[])", [organizations]);
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
