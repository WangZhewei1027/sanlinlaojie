/** Full HTTP contract smoke test against a disposable local Next.js + DB pair.
 * No .env loading, external storage, production host, or real user credentials.
 * Start Next on :13000 against content_http (or team_wb_http) on :55439, then run
 * with the same explicit DATABASE_URL. Fixtures remain available for the bounded
 * UI review. Team model: every member reads and every writer edits team content;
 * workspace assignments seeded below are history only.
 * (scripts/test-team-workbench-routes.ts covers the same routes in-process.)
 */
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import type { AssetDetailDto, CreateAssetResult, CreatePlacementResult, PlacementContentDto, PlacementDto, PublishSceneResult, SceneDetailDto } from "../lib/content-model/contracts";

// Allow a second local port when a pre-existing validation server owns :13000.
// Never accept a remote host, credentials, path, query or fragment.
const origin = process.env.CONTENT_HTTP_ORIGIN ?? "http://localhost:13000";
assert.ok(["http://localhost:13000", "http://127.0.0.1:13000", "http://localhost:13001", "http://127.0.0.1:13001"].includes(origin), "CONTENT_HTTP_ORIGIN must be an allowlisted loopback validation origin");
const marker = `content-http-${randomUUID().slice(0, 8)}`;
const password = `fixture-${randomUUID()}`;
const ids = { org: randomUUID(), foreignOrg: randomUUID(), projectA: randomUUID(), projectB: randomUUID(), foreignProject: randomUUID() };
const users = Object.fromEntries(["owner", "maintainer", "reuser", "viewer", "outsider"].map((role) => [role, { id: randomUUID(), email: `${marker}-${role}@example.test`, cookie: "" }]));
type TestUser = typeof users[string];

async function request<T>(user: TestUser | null, path: string, method = "GET", body?: unknown, expected: number[] = [200, 201]): Promise<T> {
  const response = await fetch(`${origin}${path}`, {
    method, redirect: "manual", headers: {
      Origin: origin, ...(user ? { Cookie: user.cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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
      await db.query("insert into organization(id,name) values($1,$2)", [id, `${marker} ${name}`]);
    }
    for (const [id, org, name] of [[ids.projectA, ids.org, "三林老街"], [ids.projectB, ids.org, "社区记忆"], [ids.foreignProject, ids.foreignOrg, "外部项目"]]) {
      await db.query("insert into workspace(id,organization_id,name) values($1,$2,$3)", [id, org, name]);
    }
    for (const [name, role] of [["owner", "owner"], ["maintainer", "member"], ["reuser", "member"], ["viewer", "viewer"]]) {
      await db.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3)", [ids.org, users[name].id, role]);
    }
    await db.query("insert into organization_member(organization_id,user_id,role) values($1,$2,'owner')", [ids.foreignOrg, users.outsider.id]);
    await db.query("commit");
  } catch (error) { await db.query("rollback"); throw error; }
  // Sign-up bootstrap: each personal team is v2 with zero collections, before any test collection exists.
  const personal = await db.query<{ collections: number }>(
    "select (select count(*) from workspace w where w.organization_id=o.id)::int collections from organization o where o.created_by=any($1::uuid[])",
    [Object.values(users).map((user) => user.id)]);
  assert.equal(personal.rows.length, Object.keys(users).length);
  assert.ok(personal.rows.every((row) => row.collections === 0), "personal teams start as v2 without a default workspace");
  for (const user of Object.values(users)) {
    const signIn = () => fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password }) });
    let response = await signIn();
    // Production Better Auth throttles rapid sign-ins from one loopback IP.
    // Respect its retry window instead of disabling the application's protection.
    for (let attempt = 0; response.status === 429 && attempt < 2; attempt++) {
      const seconds = Number(response.headers.get("retry-after") ?? 10);
      assert.ok(Number.isFinite(seconds) && seconds >= 0 && seconds <= 30, "unexpected sign-in retry window");
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
      response = await signIn();
    }
    assert.equal(response.status, 200, "local fixture sign-in");
    user.cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.ok(user.cookie.includes("session_token"));
  }
}

async function checks() {
  const { maintainer: a, reuser: b, viewer, outsider, owner } = users;
  const body = { name: "榕树模型", fileType: "model", visibility: "organization", payload: { kind: "model", animations: [{ index: 0, name: "sway" }] }, resources: [{ role: "primary", externalUrl: "https://fixture.invalid/tree-v1.glb" }], idempotencyKey: `${marker}-create` };
  const created = await data(request<{ data: CreateAssetResult }>(a, `/api/organizations/${ids.org}/assets`, "POST", body));
  assert.equal(created.asset.maintained_by, a.id);
  const replay = await data(request<{ data: CreateAssetResult }>(a, `/api/organizations/${ids.org}/assets`, "POST", body));
  assert.equal(replay.asset.id, created.asset.id);
  assert.equal(replay.created, false);
  await request(a, `/api/organizations/${ids.org}/assets`, "POST", { ...body, name: "changed" }, [409]);
  await request(viewer, `/api/organizations/${ids.org}/assets`, "POST", { ...body, idempotencyKey: `${marker}-viewer` }, [403]);
  await request(outsider, `/api/assets/${created.asset.id}`, "GET", undefined, [403, 404]);
  const teammate = await data(request<{ data: { lock_version: number; maintained_by: string | null } }>(b, `/api/assets/${created.asset.id}`, "PATCH", { name: "榕树模型（共同维护）", expectedLockVersion: created.asset.lock_version }));
  assert.equal(teammate.maintained_by, a.id, "a teammate edits without becoming the maintainer");
  await request(viewer, `/api/assets/${created.asset.id}`, "PATCH", { name: "viewer edit", expectedLockVersion: teammate.lock_version }, [403]);
  await request(a, `/api/assets/${created.asset.id}`, "PATCH", { name: "stale client" }, [428]);
  console.log("PASS HTTP create retry, viewer read-only cap, team editing and optimistic locks");

  const document = { schemaVersion: 4, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false,
    assets: { tree: { assetId: created.asset.id } },
    instances: [{ id: "tree-one", asset: "tree", position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: { clipName: "sway", startSeconds: 0, loop: true } }] } };
  const scene = await data(request<{ data: SceneDetailDto }>(b, `/api/organizations/${ids.org}/scenes`, "POST", { name: "社区入口", document, idempotencyKey: `${marker}-scene` }));
  assert.equal(scene.referenced_resources[0].asset_id, created.asset.id);
  await request(a, `/api/scenes/${scene.id}`, "GET");
  await request(outsider, `/api/scenes/${scene.id}`, "GET", undefined, [404]);
  const usage = await request<{ data: { impact: { restricted_count: number; items: unknown[] } } }>(a, `/api/assets/${created.asset.id}/usage`);
  assert.equal(usage.data.impact.restricted_count, 0);
  assert.equal(JSON.stringify(usage).includes("社区入口"), true, "every team member sees every same-team dependency");
  const publication = await data(request<{ data: PublishSceneResult }>(b, `/api/scenes/${scene.id}/publish`, "POST", { expectedLockVersion: scene.lock_version }));
  const publishRetry = await data(request<{ data: PublishSceneResult }>(b, `/api/scenes/${scene.id}/publish`, "POST", { expectedLockVersion: scene.lock_version }));
  assert.equal(publication.revision.id, publishRetry.revision.id);
  const placed = await data(request<{ data: CreatePlacementResult }>(b, `/api/collections/${ids.projectB}/placements`, "POST", { target: { kind: "scene_revision", sceneRevisionId: publication.revision.id }, location: { longitude: 121.5, latitude: 31.2 }, status: "active", idempotencyKey: `${marker}-place` }));
  const next = await data(request<{ data: { id: string } }>(b, `/api/assets/${created.asset.id}`, "PATCH", {
    expectedLockVersion: teammate.lock_version, payload: body.payload,
    resources: [{ role: "primary", externalUrl: "https://fixture.invalid/tree-v2.glb" }],
  }));
  assert.equal(next.id, created.asset.id);
  const fixed = await data(request<{ data: SceneDetailDto }>(b, `/api/scenes/${scene.id}`));
  assert.equal(fixed.referenced_resources[0].url, "https://fixture.invalid/tree-v2.glb");
  const manifest = await request<{ assetId: string; schemaVersion: number; resources: { tree: { url: string } } }>(null, "/api/miniapp/assets/scene", "POST", {
    asset_id: placed.placement.public_id, p_workspace_id: ids.projectB, p_organization_id: ids.org,
  });
  assert.equal(manifest.assetId, placed.placement.public_id);
  assert.ok([1, 2].includes(manifest.schemaVersion));
  assert.equal(manifest.resources.tree.url, "https://fixture.invalid/tree-v2.glb");
  const pinnedContent = await data(request<{ data: PlacementContentDto }>(b, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.projectB}`));
  assert.equal(pinnedContent.kind, "scene_revision");
  if (pinnedContent.kind === "scene_revision") {
    assert.equal(pinnedContent.scene_revision_id, publication.revision.id);
    assert.equal(pinnedContent.resources[0].url, "https://fixture.invalid/tree-v1.glb");
    assert.equal("draft" in pinnedContent, false);
  }
  await request(outsider, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.projectB}`, "GET", undefined, [404]);
  await request(owner, `/api/placements/${placed.placement.id}/content?workspace_id=${ids.foreignProject}`, "GET", undefined, [404]);
  console.log("PASS HTTP cross-collection reuse, team-wide dependency names, immutable publication");

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
  console.log("PASS HTTP optimistic conflicts, independent placements and archived-source retention");

  const teamAsset = await data(request<{ data: CreateAssetResult }>(b, `/api/organizations/${ids.org}/assets`, "POST", { ...body, name: "团队素材", idempotencyKey: `${marker}-team-asset` }));
  assert.equal(teamAsset.asset.origin_workspace_id, null);
  const teamScene = await data(request<{ data: SceneDetailDto }>(b, `/api/organizations/${ids.org}/scenes`, "POST", { name: "团队场景", idempotencyKey: `${marker}-team-scene` }));
  assert.equal(teamScene.workspace_id, null);
  const collection = await data(request<{ data: { id: string } }>(b, `/api/organizations/${ids.org}/collections`, "POST", { name: "新合集" }));
  await request(viewer, `/api/organizations/${ids.org}/collections`, "POST", { name: "viewer" }, [403]);
  await request(b, `/api/collections/${collection.id}/archive`, "POST");
  await request(b, `/api/collections/${collection.id}/archive`, "DELETE");
  console.log("PASS HTTP team asset/scene/collection routes without any workspace");
  return { assetId: created.asset.id, sceneId: scene.id, placementId: copy.placement.id };
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "Provide the dedicated local DATABASE_URL explicitly");
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55439"); assert.ok(["/content_http", "/team_wb_http"].includes(target.pathname));
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
