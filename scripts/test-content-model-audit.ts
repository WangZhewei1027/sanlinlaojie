/** Local legacy-schema audit regression. Fixtures deliberately remain for upgrade tests.
 * Supply DATABASE_URL explicitly; this script never reads environment files.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Client } from "pg";
import { audit, type AuditReport } from "./migrate/content-model/audit";
import { canonical, connect, fingerprint, options, type MigrationOptions } from "./migrate/content-model/shared";

const MARKER = "content-model-audit-fixture-1015";
const uuid = (number: number) => `10150000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ids = {
  run: uuid(1),
  organizations: { a: uuid(10), b: uuid(11), c: uuid(12), unrelated: uuid(13) },
  workspaces: { a1: uuid(20), a2: uuid(21), b: uuid(22), c: uuid(23), unrelated: uuid(24), missing: uuid(25) },
  users: { member: uuid(30), viewer: uuid(31), outsider: uuid(32), unknownRole: uuid(33) },
  assets: { model: uuid(40), scene: uuid(41), sharedAB: uuid(42), sharedBC: uuid(43), shop: uuid(44),
    orphan: uuid(45), badJson: uuid(46), missingWorkspace: uuid(47), unrelated: uuid(48),
    missingModelScene: uuid(49), viewerModel: uuid(50), missingModel: uuid(51) },
};
const args = ["--environment", "local", "--run-id", ids.run, "--organizations", ids.organizations.a];

async function argumentChecks(): Promise<MigrationOptions> {
  const opts = options(args);
  assert.equal(opts.apply, false);
  for (const key of ["--environment", "--run-id", "--organizations"]) {
    const index = args.indexOf(key);
    assert.throws(() => options([...args.slice(0, index), ...args.slice(index + 2)]), `${key} must be explicit`);
  }
  assert.throws(() => options([...args, "--run-id", ids.run]), /repeated/);
  assert.throws(() => options(["--environment", "local", "--run-id", "bad", "--organizations", ids.organizations.a]), /UUID/);
  assert.throws(() => options([...args, "--unknown"]), /Unknown argument/);
  assert.deepEqual(options([...args.slice(0, -1), `${ids.organizations.b},${ids.organizations.a},${ids.organizations.a}`]).organizations,
    [ids.organizations.a, ids.organizations.b]);
  const original = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    await assert.rejects(connect(opts), /explicitly set/);
    process.env.DATABASE_URL = "postgres://postgres@database.invalid/content_upgrade";
    await assert.rejects(connect(opts), /localhost database/);
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
  assert.equal(canonical({ z: [1, { b: 2, a: 1 }], a: null }), canonical({ a: null, z: [1, { a: 1, b: 2 }] }));
  assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 }));
  assert.notEqual(fingerprint([1, 2]), fingerprint([2, 1]), "array order is semantic");
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
  assert.equal(canonical(new Date("2026-10-15T00:00:00Z")), '"2026-10-15T00:00:00.000Z"');
  console.log("PASS explicit migration arguments, localhost guard and canonical fingerprints");
  return opts;
}

function assertDisposableTarget(): void {
  assert.ok(process.env.DATABASE_URL, "Set DATABASE_URL explicitly; .env is never loaded");
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1", "Only the dedicated loopback database is permitted");
  assert.equal(target.port, "55439", "Never run this fixture on the existing 55432 development database");
  assert.ok(["/content_upgrade", "/content_audit"].includes(target.pathname), "Only the dedicated upgrade or audit fixture database is permitted");
  assert.equal(target.username, "postgres");
}

function sceneDocument(modelId: string): string {
  return JSON.stringify({ schemaVersion: 2, content: { kind: "composition", units: "meters", durationSeconds: 10, loop: false,
    assets: { model: { assetId: modelId } }, instances: [{ id: "fixture-model", asset: "model", position: [0, 0, 0],
      quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null }] } });
}

async function assertLegacyDatabase(client: Client): Promise<void> {
  assert.ok(["content_upgrade", "content_audit"].includes((await client.query("select current_database() database")).rows[0].database));
  assert.equal((await client.query("select to_regclass('public.asset_version') relation")).rows[0].relation, null,
    "Seed only before the content-model upgrade; preserved fixtures must not be reset after cutover");
}

async function seed(client: Client): Promise<void> {
  await client.query("begin");
  try {
    for (const [name, id] of Object.entries(ids.users)) {
      await client.query("insert into auth.users(id,name,email) values($1,$2,$3) on conflict(id) do nothing",
        [id, `${MARKER}-${name}`, `${MARKER}-${name}@example.test`]);
    }
    for (const [name, id] of Object.entries(ids.organizations)) {
      await client.query("insert into organization(id,name) values($1,$2) on conflict(id) do nothing", [id, `${MARKER}-${name}`]);
    }
    const scopes = [[ids.workspaces.a1, ids.organizations.a], [ids.workspaces.a2, ids.organizations.a],
      [ids.workspaces.b, ids.organizations.b], [ids.workspaces.c, ids.organizations.c], [ids.workspaces.unrelated, ids.organizations.unrelated],
      [ids.workspaces.missing, ids.organizations.a]];
    for (const [id, organization] of scopes) {
      await client.query("insert into workspace(id,name,organization_id) values($1,$2,$3) on conflict(id) do nothing", [id, `${MARKER}-${id}`, organization]);
    }
    for (const [user, role] of [[ids.users.member, "member"], [ids.users.viewer, "viewer"], [ids.users.unknownRole, "member"]]) {
      await client.query("insert into organization_member(organization_id,user_id,role) values($1,$2,$3) on conflict(organization_id,user_id) do nothing",
        [ids.organizations.a, user, role]);
    }
    for (const [user, role] of [[ids.users.member, "member"], [ids.users.viewer, "editor"], [ids.users.outsider, "member"], [ids.users.unknownRole, "legacy-custom"]]) {
      await client.query("insert into workspace_assignment(workspace_id,user_id,role) values($1,$2,$3) on conflict(user_id,workspace_id) do nothing",
        [ids.workspaces.a1, user, role]);
    }
    const a = ids.assets;
    const w = ids.workspaces;
    const rows: { id: string; kind: string; workspaces: string[]; url?: string; text?: string; location?: string; creator?: string }[] = [
      { id: a.model, kind: "model", workspaces: [w.a1, w.a2], url: "https://fixture.invalid/model-v1.glb", creator: ids.users.member },
      { id: a.scene, kind: "scene", workspaces: [w.a1, w.a2], text: sceneDocument(a.model), location: "POINT(121.5 31.2)" },
      { id: a.sharedAB, kind: "model", workspaces: [w.a1, w.b], url: "https://fixture.invalid/ab.glb" },
      { id: a.sharedBC, kind: "model", workspaces: [w.b, w.c], url: "https://fixture.invalid/bc.glb" },
      { id: a.shop, kind: "shop", workspaces: [w.a1], url: "https://fixture.invalid/shop.jpg" },
      { id: a.orphan, kind: "model", workspaces: [], url: "https://fixture.invalid/orphan.glb" },
      { id: a.badJson, kind: "scene", workspaces: [w.a1], text: "{broken" },
      { id: a.missingWorkspace, kind: "text", workspaces: [w.missing], text: "unowned" },
      { id: a.unrelated, kind: "model", workspaces: [w.unrelated], url: "https://fixture.invalid/unrelated.glb" },
      { id: a.missingModelScene, kind: "scene", workspaces: [w.a1], text: sceneDocument(a.missingModel) },
      { id: a.viewerModel, kind: "model", workspaces: [w.a1], url: "https://fixture.invalid/viewer.glb", creator: ids.users.viewer },
    ];
    for (const row of rows) {
      const result = await client.query(`insert into asset(id,name,file_type,workspace_id,file_url,text_content,location,created_by,metadata)
        values($1,$2,$3,$4::uuid[],$5,$6,ST_GeomFromText($7,4326),$8,$9::jsonb)
        on conflict(id) do update set name=excluded.name,file_type=excluded.file_type,workspace_id=excluded.workspace_id,
          file_url=excluded.file_url,text_content=excluded.text_content,location=excluded.location,created_by=excluded.created_by,
          metadata=excluded.metadata where asset.metadata->>'fixture'=$10 returning id`,
      [row.id, `${MARKER}-${row.id}`, row.kind, row.workspaces, row.url ?? null, row.text ?? null, row.location ?? null,
        row.creator ?? null, JSON.stringify({ fixture: MARKER }), MARKER]);
      assert.equal(result.rowCount, 1, "Never overwrite an asset outside this marked fixture");
    }
    // The old array trigger validates writes, but a later workspace deletion can leave a stale ID.
    await client.query("delete from workspace where id=$1", [ids.workspaces.missing]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
}

function mapping(report: AuditReport, id: string) {
  const value = report.mappings.find((entry) => entry.source_id === id);
  assert.ok(value, `Expected fixture mapping ${id}`);
  return value;
}

function assertMappings(report: AuditReport): void {
  const { organizations: o, assets: a, users: u } = ids;
  assert.deepEqual(report.required_organizations, [o.a, o.b, o.c], "shared rows form a transitive cutover group");
  assert.equal(report.mappings.some((entry) => entry.source_id === a.unrelated), false);
  const model = mapping(report, a.model);
  assert.equal(model.disposition, "migrate");
  assert.deepEqual(model.targets[0].workspace_ids, [ids.workspaces.a1, ids.workspaces.a2]);
  assert.equal(model.targets[0].source_workspace_id, null, "multi-project provenance must not pick the first workspace");
  assert.equal(model.targets[0].create_placement, false);
  assert.equal(model.targets[0].maintained_by, u.member);
  assert.equal(mapping(report, a.viewerModel).targets[0].maintained_by, null);
  const scene = mapping(report, a.scene);
  assert.equal(scene.disposition, "review");
  assert.deepEqual(scene.dependencies, [a.model]);
  assert.ok(scene.issues.includes(`source_workspace_requires_review:${o.a}`));
  assert.equal(scene.targets[0].create_placement, true);
  for (const id of [a.sharedAB, a.sharedBC]) {
    const shared = mapping(report, id);
    assert.equal(shared.disposition, "review");
    assert.equal(shared.targets.length, 2);
    assert.ok(shared.targets.every((target) => target.target_id === null));
  }
  assert.equal(mapping(report, a.shop).disposition, "migrate");
  assert.equal(mapping(report, a.shop).targets[0].create_placement, true, "unlocated shops retain a directory placement");
  for (const [id, issue] of [[a.orphan, "no_valid_workspace"], [a.badJson, "invalid_scene_json"],
    [a.missingWorkspace, "missing_workspace"], [a.missingModelScene, `missing_model:${a.missingModel}`]]) {
    assert.equal(mapping(report, id).disposition, "isolate");
    assert.ok(mapping(report, id).issues.includes(issue));
  }
  const assignment = (user: string) => report.assignments.find((entry) => entry.user_id === user && entry.workspace_id === ids.workspaces.a1);
  assert.equal(assignment(u.member)?.proposed_role, "editor");
  assert.equal(assignment(u.viewer)?.proposed_role, "viewer");
  assert.equal(assignment(u.outsider)?.proposed_role, null);
  assert.equal(assignment(u.outsider)?.issue, "not_an_organization_member");
  assert.equal(assignment(u.unknownRole)?.proposed_role, null);
  assert.equal(assignment(u.unknownRole)?.issue, "unknown_legacy_role");
  console.log("PASS organization closure, placement/identity mapping, orphan isolation and legacy roles");
}

async function identityProjectionCheck(client: Client, opts: MigrationOptions, original: AuditReport): Promise<void> {
  let intercepted = false;
  const proxy = new Proxy(client, { get(target, property) {
    if (property !== "query") return Reflect.get(target, property);
    return async (text: string, values?: unknown[]) => {
      if (/\bfrom\s+asset\s+a\b/i.test(text)) {
        assert.equal((await client.query("show transaction_read_only")).rows[0].transaction_read_only, "on");
        // Add identity columns only to a derived relation, leaving the actual legacy schema untouched.
        // Keep alias `a` and the optional mapped-split exclusion WHERE clause intact.
        text = text.replace(/\bfrom\s+asset\s+a\b/i, `from (select legacy_asset.*, '${ids.organizations.a}'::uuid organization_id,
          '${uuid(90)}'::uuid current_version_id, '${ids.users.member}'::uuid maintained_by, 99 lock_version
          from asset legacy_asset) a`);
        intercepted = true;
      }
      return target.query(text, values);
    };
  } });
  const staged = await audit(proxy, opts);
  assert.equal(intercepted, true, "Exercise the explicit source projection");
  assert.equal(staged.source_fingerprint, original.source_fingerprint);
  assert.deepEqual(staged.mappings, original.mappings, "staged identity fields cannot change legacy source hashes");
  console.log("PASS audit uses a read-only snapshot and ignores staged identity columns without altering schema");
}

/** Audit owns BEGIN/COMMIT. Nest it in a savepoint only for rollback-only fixture tests.
 * The real read-only transaction boundary is separately exercised above.
 */
async function withRollback(client: Client, run: (snapshot: Client) => Promise<void>): Promise<void> {
  await client.query("begin isolation level repeatable read");
  const snapshot = new Proxy(client, { get(target, property) {
    if (property !== "query") return Reflect.get(target, property);
    return async (text: string, values?: unknown[]) => {
      if (/^begin /i.test(text)) return target.query("savepoint audit_fixture_snapshot");
      if (text === "commit") return target.query("release savepoint audit_fixture_snapshot");
      if (text === "rollback") return target.query("rollback to savepoint audit_fixture_snapshot");
      return target.query(text, values);
    };
  } });
  try { await run(snapshot); }
  finally { await client.query("rollback"); }
}

async function geometryChecks(client: Client, opts: MigrationOptions, original: AuditReport): Promise<void> {
  const cases = [
    { wkt: "LINESTRING(121 31,122 32)", srid: 4326, disposition: "isolate", issue: "invalid_gps_point" },
    { wkt: "POINT(181 31)", srid: 4326, disposition: "isolate", issue: "invalid_gps_point" },
    { wkt: "POINT(121 91)", srid: 4326, disposition: "isolate", issue: "invalid_gps_point" },
    { wkt: "POINT(121 31)", srid: 3857, disposition: "review", issue: "coordinate_reference_requires_review" },
    { wkt: "POINT(121 31)", srid: 0, disposition: "migrate", issue: null },
  ];
  for (const test of cases) await withRollback(client, async (snapshot) => {
    await client.query("update asset set location=ST_GeomFromText($1,$2) where id=$3", [test.wkt, test.srid, ids.assets.viewerModel]);
    const report = await audit(snapshot, opts);
    assert.equal(report.mappings.length, original.mappings.length, "one malformed geometry must not fail the batch");
    const result = mapping(report, ids.assets.viewerModel);
    assert.equal(result.disposition, test.disposition, `${test.wkt}, SRID ${test.srid}`);
    if (test.issue) assert.ok(result.issues.includes(test.issue));
    else assert.deepEqual(result.issues, []);
  });
  assert.equal((await audit(client, opts)).source_fingerprint, original.source_fingerprint);
  console.log("PASS non-Point/out-of-range geometry is isolated; unknown SRID is reviewed; SRID 0 remains supported");
}

async function permissionFingerprintChecks(client: Client, opts: MigrationOptions, original: AuditReport): Promise<void> {
  const sourceHashes = (report: AuditReport) => report.mappings.map((entry) => [entry.source_id, entry.source_hash, entry.dependency_hash]);
  await withRollback(client, async (snapshot) => {
    await client.query("update workspace_assignment set role='viewer' where workspace_id=$1 and user_id=$2", [ids.workspaces.a1, ids.users.member]);
    const changed = await audit(snapshot, opts);
    assert.deepEqual(sourceHashes(changed), sourceHashes(original), "asset content remains unchanged");
    assert.notDeepEqual(changed.assignments, original.assignments);
    assert.notEqual(changed.source_fingerprint, original.source_fingerprint, "assignment-only changes invalidate the cutover fingerprint");
  });
  await withRollback(client, async (snapshot) => {
    // Remove this user's assignment inside the transaction so only maintainer eligibility changes below.
    await client.query("delete from workspace_assignment where user_id=$1", [ids.users.member]);
    const before = await audit(snapshot, opts);
    await client.query("update organization_member set role='viewer' where organization_id=$1 and user_id=$2", [ids.organizations.a, ids.users.member]);
    const changed = await audit(snapshot, opts);
    assert.deepEqual(changed.assignments, before.assignments);
    assert.deepEqual(sourceHashes(changed), sourceHashes(before));
    assert.equal(mapping(before, ids.assets.model).targets[0].maintained_by, ids.users.member);
    assert.equal(mapping(changed, ids.assets.model).targets[0].maintained_by, null);
    assert.notEqual(changed.source_fingerprint, before.source_fingerprint, "maintainer-only mapping changes invalidate the cutover fingerprint");
  });
  assert.equal((await audit(client, opts)).source_fingerprint, original.source_fingerprint);
  console.log("PASS assignment-only and maintainer-only changes alter the cutover fingerprint; rollback restores all fixture state");
}

async function main(): Promise<void> {
  const opts = await argumentChecks();
  assertDisposableTarget();
  const client = await connect(opts);
  try {
    await assertLegacyDatabase(client);
    const existingFixtures = process.argv.includes("--existing-fixtures");
    if (!existingFixtures) await seed(client);
    const original = await audit(client, opts);
    assertMappings(original);
    assert.equal((await audit(client, opts)).source_fingerprint, original.source_fingerprint, "audit is repeatable");
    const before = mapping(original, ids.assets.scene);
    await withRollback(client, async (snapshot) => {
      await client.query("update asset set file_url=$1 where id=$2", ["https://fixture.invalid/model-v2.glb", ids.assets.model]);
      const changed = await audit(snapshot, opts);
      assert.equal(mapping(changed, ids.assets.scene).source_hash, before.source_hash, "Scene JSON did not change");
      assert.notEqual(mapping(changed, ids.assets.scene).dependency_hash, before.dependency_hash);
      assert.notEqual(changed.source_fingerprint, original.source_fingerprint);
    });
    assert.equal((await audit(client, opts)).source_fingerprint, original.source_fingerprint, "restore preserves the upgrade fixture baseline");
    console.log("PASS Scene dependency hash changes when a model URL changes while Scene JSON stays unchanged");
    await identityProjectionCheck(client, opts, original);
    await geometryChecks(client, opts, original);
    await permissionFingerprintChecks(client, opts, original);
    if (existingFixtures) {
      console.log("PASS existing fixtures and fixture.json preserved; every temporary change rolled back");
      return;
    }
    mkdirSync("/tmp/spatial-content-implementation", { recursive: true });
    const fixtureFile = new URL(process.env.DATABASE_URL!).pathname === "/content_audit"
      ? "/tmp/spatial-content-implementation/fixture-audit.json" : "/tmp/spatial-content-implementation/fixture.json";
    writeFileSync(fixtureFile, `${JSON.stringify({ fixture: MARKER, ...ids,
      sourceFingerprint: original.source_fingerprint, requiredOrganizations: original.required_organizations }, null, 2)}\n`, { mode: 0o600 });
    console.log(`PASS marked fixtures retained; IDs written to ${fixtureFile}`);
  } finally { await client.end(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]") : "Audit test failed");
  process.exitCode = 1;
});
