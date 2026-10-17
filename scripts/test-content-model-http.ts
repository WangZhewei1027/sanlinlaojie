/** Full HTTP contract smoke test against a disposable local Next.js + DB pair.
 * No .env loading, external storage, production host, or real user credentials.
 * Start Next on :13000 against content_http on :55439, then run with the same
 * explicit DATABASE_URL. Fixtures remain available for the bounded UI review.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import type { AssetDetailDto, CreateAssetResult, CreatePlacementResult, PlacementContentDto, PlacementDto, PublishSceneResult, SceneDetailDto } from "../lib/content-model/contracts";

const origin = "http://localhost:13000";
const marker = `content-http-${randomUUID().slice(0, 8)}`;
const password = `fixture-${randomUUID()}`;
const ids = { org: randomUUID(), foreignOrg: randomUUID(), projectA: randomUUID(), projectB: randomUUID(), foreignProject: randomUUID() };
const users = Object.fromEntries(["owner", "maintainer", "reuser", "viewer", "outsider"].map((role) => [role, { id: randomUUID(), email: `${marker}-${role}@example.test`, cookie: "" }]));
type TestUser = typeof users[string];

async function request<T>(user: TestUser | null, path: string, method = "GET", body?: unknown, expected: number[] = [200, 201], v2 = true): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    method, redirect: "manual", headers: {
      Origin: origin, ...(user ? { Cookie: user.cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(v2 ? { "X-Content-Model": "2" } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let json: unknown;
  try { json = JSON.parse(raw); } catch { json = { nonJson: raw.slice(0, 100) }; }
  assert.ok(expected.includes(response.status), `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(json)}`);
  return json as T;
}
const data = async <T>(promise: Promise<{ data: T }>) => (await promise).data;

async function seed(db: Client) {
  const hashed = await bcrypt.hash(password, 10);
  await db.query("begin");
  try {
    for (const [role, user] of Object.entries(users)) {
      await db.query("insert into auth.users(id,email,name,email_verified) values($1,$2,$3,true)", [user.id, user.email, `${marker} ${role}`]);
      await db.query("insert into auth.account(user_id,account_id,provider_id,password) values($1::uuid,$1::text,'credential',$2)", [user.id, hashed]);
    }
    for (const [id, name] of [[ids.org, "共同创作团队"], [ids.foreignOrg, "隔离团队"]]) {
      await db.query("insert into organization(id,name,content_model_state) values($1,$2,'v2')", [id, `${marker} ${name}`]);
    }
    for (const [id, org, name] of [[ids.projectA, ids.org, "三林老街"], [ids.projectB, ids.org, "社区记忆"], [ids.foreignProject, ids.foreignOrg, "外部项目"]]) {
      await db.query("insert into workspace(id,organization_id,name) values($1,$2,$3)", [id, org, name]);
    }
    for (const [name, role] of [["owner", "owner"], ["maintainer", "member"], ["reuser", "member"], ["viewer", "viewer"]]) {
      await db.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3)", [ids.org, users[name].id, role]);
    }
    await db.query("insert into organization_member(organization_id,user_id,role) values($1,$2,'owner')", [ids.foreignOrg, users.outsider.id]);
    for (const [user, project, role] of [[users.maintainer.id, ids.projectA, "editor"], [users.reuser.id, ids.projectB, "editor"], [users.viewer.id, ids.projectA, "manager"]]) {
      await db.query("insert into workspace_assignment(user_id,workspace_id,role) values($1,$2,$3)", [user, project, role]);
    }
    await db.query("commit");
  } catch (error) { await db.query("rollback"); throw error; }
  for (const user of Object.values(users)) {
    const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password }) });
    assert.equal(response.status, 200, "local fixture sign-in");
    user.cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.ok(user.cookie.includes("session_token"));
  }
}

async function checks() {
  const { maintainer: a, reuser: b, viewer, outsider, owner } = users;
  const body = { name: "榕树模型", fileType: "model", visibility: "organization", payload: { kind: "model", animations: [{ index: 0, name: "sway" }] }, resources: [{ role: "primary", externalUrl: "https://fixture.invalid/tree-v1.glb" }], idempotencyKey: `${marker}-create` };
  const created = await data(request<{ data: CreateAssetResult }>(a, `/api/workspaces/${ids.projectA}/assets`, "POST", body));
  assert.equal(created.asset.maintained_by, a.id);
  const replay = await data(request<{ data: CreateAssetResult }>(a, `/api/workspaces/${ids.projectA}/assets`, "POST", body));
  assert.equal(replay.asset.id, created.asset.id);
  assert.equal(replay.created, false);
  await request(a, `/api/workspaces/${ids.projectA}/assets`, "POST", { ...body, name: "changed" }, [409]);
  await request(viewer, `/api/workspaces/${ids.projectA}/assets`, "POST", { ...body, idempotencyKey: `${marker}-viewer` }, [403]);
  await request(outsider, `/api/assets/${created.asset.id}`, "GET", undefined, [403, 404]);
  await request(b, `/api/assets/${created.asset.id}`, "PATCH", { name: "steal", expectedLockVersion: created.asset.lock_version }, [403]);
  await request(a, `/api/assets/${created.asset.id}`, "PATCH", { name: "stale client" }, [409], false);
  console.log("PASS HTTP create retry, project viewer cap, source maintenance and old-client fence");

  const document = { schemaVersion: 3, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false,
    assets: { tree: { assetId: created.asset.id, assetVersionId: created.version.id } },
    instances: [{ id: "tree-one", asset: "tree", position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: { clipName: "sway", startSeconds: 0, loop: true } }] } };
  const scene = await data(request<{ data: SceneDetailDto }>(b, `/api/workspaces/${ids.projectB}/scenes`, "POST", { name: "社区入口", document, idempotencyKey: `${marker}-scene` }));
  assert.equal(scene.referenced_resources[0].asset_version_id, created.version.id);
  await request(a, `/api/scenes/${scene.id}`, "GET", undefined, [403, 404]);
  const usage = await request<{ data: { impact: { restricted_count: number; items: unknown[] } } }>(a, `/api/assets/${created.asset.id}/usage`);
  assert.ok(usage.data.impact.restricted_count > 0);
  assert.equal(JSON.stringify(usage).includes("社区入口"), false, "dependency names do not cross project permissions");
  await request(a, `/api/assets/${created.asset.id}/workspace-grants?workspace_id=${ids.projectB}`, "DELETE", undefined, [409]);
  const publication = await data(request<{ data: PublishSceneResult }>(b, `/api/scenes/${scene.id}/publish`, "POST", { expectedLockVersion: scene.lock_version }));
  const publishRetry = await data(request<{ data: PublishSceneResult }>(b, `/api/scenes/${scene.id}/publish`, "POST", { expectedLockVersion: scene.lock_version }));
  assert.equal(publication.revision.id, publishRetry.revision.id);
  const placed = await data(request<{ data: CreatePlacementResult }>(b, `/api/workspaces/${ids.projectB}/placements`, "POST", { target: { kind: "scene_revision", sceneRevisionId: publication.revision.id }, location: { longitude: 121.5, latitude: 31.2 }, status: "active", idempotencyKey: `${marker}-place` }));
  const next = await data(request<{ data: { version: { id: string } } }>(a, `/api/assets/${created.asset.id}/versions`, "POST", {
    expectedLockVersion: created.asset.lock_version, payload: body.payload,
    resources: [{ role: "primary", externalUrl: "https://fixture.invalid/tree-v2.glb" }], idempotencyKey: `${marker}-version`,
  }));
  assert.notEqual(next.version.id, created.version.id);
  const fixed = await data(request<{ data: SceneDetailDto }>(b, `/api/scenes/${scene.id}`));
  assert.equal(fixed.referenced_resources[0].url, "https://fixture.invalid/tree-v1.glb");
  assert.equal(fixed.referenced_resources[0].upgrade_available, true);
  const manifest = await request<{ assetId: string; schemaVersion: number; resources: { tree: { url: string } } }>(null, "/api/miniapp/assets/scene", "POST", {
    asset_id: placed.placement.public_id, p_workspace_id: ids.projectB, p_organization_id: ids.org,
  });
  assert.equal(manifest.assetId, placed.placement.public_id);
  assert.ok([1, 2].includes(manifest.schemaVersion));
  assert.equal(manifest.resources.tree.url, "https://fixture.invalid/tree-v1.glb");
  const pinnedContent = await data(request<{ data: PlacementContentDto }>(b, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.projectB}`));
  assert.equal(pinnedContent.kind, "scene_revision");
  if (pinnedContent.kind === "scene_revision") {
    assert.equal(pinnedContent.scene_revision_id, publication.revision.id);
    assert.equal(pinnedContent.resources[0].url, "https://fixture.invalid/tree-v1.glb");
    assert.equal("draft" in pinnedContent, false);
  }
  await request(outsider, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.projectB}`, "GET", undefined, [404]);
  await request(owner, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.foreignProject}`, "GET", undefined, [404]);
  console.log("PASS HTTP cross-project reuse, hidden dependency names, grant protection and immutable publication");

  const saved = await data(request<{ data: SceneDetailDto }>(b, `/api/scenes/${scene.id}`, "PATCH", { name: "社区入口 · 草稿", expectedLockVersion: fixed.lock_version }));
  await request(b, `/api/scenes/${scene.id}`, "PATCH", { name: "lost edit", expectedLockVersion: fixed.lock_version }, [409]);
  await request(b, `/api/scenes/${scene.id}`, "PATCH", { name: "missing condition" }, [428]);
  assert.ok(saved.lock_version > fixed.lock_version);
  const point = placed.placement;
  const copy = await data(request<{ data: CreatePlacementResult }>(b, `/api/placements/${point.id}/copy`, "POST", { targetWorkspaceId: ids.projectB }));
  assert.notEqual(copy.placement.id, point.id);
  await request(b, `/api/placements/${point.id}`, "PATCH", { expectedLockVersion: point.lock_version, status: "paused" });
  const separate = await data(request<{ data: PlacementDto }>(b, `/api/placements/${copy.placement.id}`));
  assert.equal(separate.status, "active");
  const nearby = await request<{ id: string }[]>(null, "/api/miniapp/assets/nearby", "POST", {
    user_lat: 31.2, user_lng: 121.5, max_distance_meters: 100,
    p_workspace_id: ids.projectB, p_organization_id: ids.org,
  });
  assert.equal(nearby.some((row) => row.id === point.public_id), false, "paused point leaves discovery");
  assert.equal(nearby.filter((row) => row.id === copy.placement.public_id).length, 1, "independent copy is discovered once");
  const detail = await data(request<{ data: AssetDetailDto }>(a, `/api/assets/${created.asset.id}`));
  await request(a, `/api/assets/${created.asset.id}?expectedLockVersion=${detail.lock_version}`, "DELETE");
  const retained = await data(request<{ data: SceneDetailDto }>(b, `/api/scenes/${scene.id}`));
  assert.equal(retained.referenced_resources[0].url, "https://fixture.invalid/tree-v1.glb");
  await request(owner, `/api/workspaces/${ids.projectB}`, "DELETE", undefined, [409]);
  console.log("PASS HTTP optimistic conflicts, independent placements and archived-source retention");
  return { assetId: created.asset.id, sceneId: scene.id, placementId: copy.placement.id };
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "Provide the dedicated local DATABASE_URL explicitly");
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55439"); assert.equal(target.pathname, "/content_http");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await seed(db);
    const directory = "/tmp/spatial-content-implementation";
    mkdirSync(directory, { recursive: true });
    const session = { origin, marker, ids, email: users.owner.email, password };
    writeFileSync(`${directory}/http-session.json`, JSON.stringify(session, null, 2), { mode: 0o600 });
    const content = await checks();
    writeFileSync(`${directory}/http-session.json`, JSON.stringify({ ...session, content }, null, 2), { mode: 0o600 });
    console.log("PASS full HTTP smoke; disposable UI fixture saved locally (credentials are not printed)");
  } finally { await db.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "HTTP regression failed"); process.exitCode = 1; });
