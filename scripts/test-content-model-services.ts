/** Real DB integration. Run with explicit DATABASE_URL and tsx --conditions react-server.
 * Uses only content_services on the dedicated loopback container; no auth sessions or OSS.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { Actor } from "../lib/content-model/access.server";
import type { Trx } from "../lib/content-model/tx.server";
import { assertServicesDatabase, cleanupServicesFixture, fixtureIds, seedRuntimeProjectionFixture, seedServicesFixture, versionedDocument } from "./test-content-model-services-fixture";

const failures: string[] = [];
const matchAt = process.argv.indexOf("--match");
const nameFilter = matchAt >= 0 ? process.argv[matchAt + 1] : undefined;
if (matchAt >= 0) assert.ok(nameFilter, "--match requires a test-name substring");
let passed = 0;
async function check(name: string, run: () => Promise<void>): Promise<void> {
  if (nameFilter && !name.includes(nameFilter)) return;
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}

async function main(): Promise<void> {
  assertServicesDatabase();
  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "content-services-regression" });
  await client.connect();
  const { db, sql } = await import("../lib/db");
  const access = await import("../lib/content-model/access.server");
  const { ContentError } = await import("../lib/content-model/errors");
  const { declareWriter } = await import("../lib/content-model/tx.server");
  const dto = await import("../lib/assets/dto.server");
  const usage = await import("../lib/assets/usage.server");
  const versions = await import("../lib/assets/versions.server");
  const assetService = await import("../lib/assets/service.server");
  const sceneService = await import("../lib/scene/service.server");
  const placementService = await import("../lib/placements/service.server");
  const runtime = await import("../lib/placements/runtime.server");
  const { resolveLinkAssetData, parseLinkAssetInput } = await import("../lib/link-asset");
  const receipts = await import("../lib/upload/receipts.server");
  const retention = await import("../lib/storage/retention.server");
  const f = fixtureIds();
  const rejectCode = (run: () => Promise<unknown>, code: string) => assert.rejects(run,
    (error: unknown) => {
      assert.ok(error instanceof ContentError && error.code === code,
        `Expected ${code}; got ${error instanceof ContentError ? error.code : String(error)}`);
      return true;
    }, `Expected ${code}`);
  const rejectSql = (query: string, values: unknown[], code: string) => assert.rejects(() => client.query(query, values),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === code, `Expected SQLSTATE ${code}`);
  const rollback = async (run: (trx: Trx) => Promise<void>, writer: "v2" | "purge" = "v2") => {
    const sentinel = new Error("rollback test fixture");
    try {
      await db.transaction().execute(async (trx) => {
        await declareWriter(trx, writer);
        await run(trx);
        throw sentinel;
      });
    } catch (error) { if (error !== sentinel) throw error; }
  };

  try {
    await seedServicesFixture(client, f);
    const actors = Object.fromEntries(await Promise.all(Object.entries(f.users).map(async ([name, id]) => [name, await access.loadActor(db, id)]))) as Record<keyof typeof f.users, Actor>;

    await check("T01/T02 real Actor: project reuse does not grant source maintenance or cross-tenant ID access", async () => {
      const target = await access.requireWorkspaceEdit(db, actors.editor, f.workspaces.b);
      const reusable = await access.requireAssetRead(db, actors.editor, f.assets.restricted);
      assert.equal(reusable.canMaintain, false);
      await rejectCode(() => access.requireAssetMaintain(db, actors.editor, f.assets.restricted), "FORBIDDEN");
      await rejectCode(() => access.requireAssetRead(db, actors.foreign, f.assets.shared), "NOT_FOUND");
      await rejectCode(() => access.requireAssetRead(db, actors.unassigned, f.assets.restricted), "NOT_FOUND");
      assert.equal(await dto.loadAssetDto(db, actors.foreign, f.assets.shared), null);
      await rollback(async (trx) => {
        assert.equal((await access.ensureAssetUse(trx, actors.editor, f.assets.shared, target)).id, f.assets.shared);
        await rejectCode(() => access.ensureAssetUse(trx, actors.editor, f.assets.foreign, target), "NOT_FOUND");
      });
      const source = await access.requireAssetMaintain(db, actors.maintainer, f.assets.shared);
      assert.equal(source.canMaintain, true);
    });

    await check("T02/T16 org viewer caps an editor assignment; missing assignment cannot access a project", async () => {
      const viewer = await access.requireWorkspaceRead(db, actors.viewer, f.workspaces.b);
      assert.equal(viewer.projectRole, "viewer");
      assert.equal(viewer.capabilities.can_edit, false);
      await rejectCode(() => access.requireWorkspaceEdit(db, actors.viewer, f.workspaces.b), "FORBIDDEN");
      await rejectCode(() => access.requireWorkspaceRead(db, actors.unassigned, f.workspaces.b), "FORBIDDEN");
      const manager = await access.requireWorkspaceManage(db, actors.manager, f.workspaces.b);
      assert.equal(manager.capabilities.can_manage_members, true);
      assert.equal(manager.capabilities.can_assign_manager, false);
    });

    await check("T02 usage and grants expose visible names plus restricted counts, never private project names", async () => {
      await access.requireAssetRead(db, actors.editor, f.assets.shared);
      const impact = await usage.computeImpact(db, actors.editor, f.assets.shared);
      assert.ok(impact.restricted_count >= 4, "source and secret drafts/revisions are unreadable to project B");
      assert.ok(impact.items.length >= 3, "B sees its own draft and two direct placements");
      assert.ok(impact.items.every((item) => item.workspace_id === f.workspaces.b));
      assert.equal(JSON.stringify(impact.items).includes("private-draft"), true, "the readable B draft remains named");
      assert.equal(JSON.stringify(impact.items).includes("secret"), false);
      const grants = await usage.listGrants(db, actors.editor, f.assets.shared);
      assert.ok(grants.filter((grant) => grant.workspace_id !== f.workspaces.b).every((grant) => grant.workspace_name === null && grant.dependency_count === null));
    });

    await check("T03/T04 appending a source version leaves all existing draft/published/placement references pinned", async () => {
      const previous = (await dto.loadVersionDtos(db, [f.versions.shared1, f.versions.shared2]));
      assert.notEqual(previous.get(f.versions.shared1)?.resources[0].url, previous.get(f.versions.shared2)?.resources[0].url);
      await rollback(async (trx) => {
        const source = await access.requireAssetMaintain(trx, actors.maintainer, f.assets.shared, { forUpdate: true });
        const appended = await versions.appendVersion(trx, actors.maintainer, source.asset, { kind: "model" },
          [{ role: "primary", externalUrl: "https://external-fixture.invalid/model-v3.glb" }]);
        assert.equal(appended.versionNo, 3);
        assert.equal((await trx.selectFrom("asset").select("current_version_id").where("id", "=", f.assets.shared).executeTakeFirstOrThrow()).current_version_id, appended.versionId);
        for (const table of ["scene_asset_ref", "scene_revision_asset_ref", "placement"] as const) {
          const refs = await trx.selectFrom(table).select("asset_version_id").where("asset_id", "=", f.assets.shared).execute();
          assert.ok(refs.length > 0);
          assert.ok(refs.every((row) => row.asset_version_id === f.versions.shared1), `${table} must stay pinned to v1`);
        }
        assert.deepEqual((await dto.loadVersionDtos(trx, [f.versions.shared1])).get(f.versions.shared1), previous.get(f.versions.shared1));
      });
    });

    await check("T02/T09 version file reuse rejects another tenant and receipts enforce actor/tenant/purpose/expiry", async () => {
      await rollback(async (trx) => {
        const source = await access.requireAssetMaintain(trx, actors.maintainer, f.assets.shared, { forUpdate: true });
        await rejectCode(() => versions.appendVersion(trx, actors.maintainer, source.asset, { kind: "model" },
          [{ role: "primary", fromVersionId: f.versions.foreign, fromRole: "primary" }]), "FORBIDDEN");
        assert.equal((await receipts.loadCommitReceipts(trx, f.users.maintainer, f.organizations.team, [f.receipts.active])).size, 1);
        await rejectCode(() => receipts.loadCommitReceipts(trx, f.users.editor, f.organizations.team, [f.receipts.active]), "RECEIPT_INVALID");
        await rejectCode(() => receipts.loadCommitReceipts(trx, f.users.maintainer, f.organizations.foreign, [f.receipts.active]), "RECEIPT_INVALID");
        await rejectCode(() => receipts.loadCommitReceipts(trx, f.users.maintainer, f.organizations.team, [f.receipts.wrongPurpose]), "RECEIPT_INVALID");
        await rejectCode(() => receipts.loadCommitReceipts(trx, f.users.maintainer, f.organizations.team, [f.receipts.expired]), "RECEIPT_INVALID");
      });
    });

    await check("T08/T09 immutable storage versions, tenant FKs and Placement XOR reject invalid SQL", async () => {
      await rejectSql("update asset_version set payload='{}'::jsonb where id=$1", [f.versions.shared1], "55000");
      await rejectSql("update asset_version_resource set storage_key='assets/replaced.glb' where asset_version_id=$1", [f.versions.shared1], "55000");
      await rejectSql("delete from scene_revision where id=$1", [f.revisions.a], "55000");
      await rejectSql("insert into asset_workspace_grant(asset_id,workspace_id,organization_id) values($1,$2,$3)",
        [f.assets.shared, f.workspaces.foreign, f.organizations.team], "23503");
      await rejectSql("insert into placement(organization_id,workspace_id,asset_id,asset_version_id,scene_revision_id) values($1,$2,$3,$4,$5)",
        [f.organizations.team, f.workspaces.b, f.assets.shared, f.versions.shared1, f.revisions.a], "23514");
      await rejectSql("insert into placement(organization_id,workspace_id) values($1,$2)", [f.organizations.team, f.workspaces.b], "23514");
      await rejectSql("insert into placement(organization_id,workspace_id,asset_id,asset_version_id) values($1,$2,$3,$4)",
        [f.organizations.team, f.workspaces.b, f.assets.foreign, f.versions.foreign], "23503");
      await rejectSql("insert into scene_asset_ref(scene_id,organization_id,resource_alias,asset_id,asset_version_id) values($1,$2,'foreign',$3,$4)",
        [f.scenes.b, f.organizations.team, f.assets.foreign, f.versions.foreign], "23503");
    });

    await check("T08 archive permits existing references while blocking new raw reuse", async () => {
      await rollback(async (trx) => {
        await trx.updateTable("asset").set({ state: "archived" }).where("id", "=", f.assets.shared).execute();
        const target = await access.requireWorkspaceEdit(trx, actors.editor, f.workspaces.b);
        await rejectCode(() => access.ensureAssetUse(trx, actors.editor, f.assets.shared, target), "ARCHIVED");
        assert.equal((await access.ensureAssetUse(trx, actors.editor, f.assets.shared, target, { existingReference: true })).id, f.assets.shared);
        assert.ok((await dto.loadVersionDtos(trx, [f.versions.shared1])).get(f.versions.shared1)?.resources[0].url);
        assert.ok(usage.hasDependencies(await usage.computeImpact(trx, actors.owner, f.assets.shared)));
      });
    });

    await check("T09 retention protects historical/shared-tenant resources, receipts, Shop images and derived audio", async () => {
      assert.equal(await retention.isObjectDeletionEnabled(db), false, "No test may enable physical object deletion");
      for (const key of [f.keys.shared, f.keys.current, f.keys.lease, f.keys.checkin, f.keys.audio.replace(/\.webm$/, ".m4a")]) {
        assert.equal(await retention.isKeyProtected(db, key), true, key);
      }
      assert.equal(await retention.isKeyProtected(db, f.keys.expired), false);
      assert.equal(await retention.isKeyProtected(db, f.keys.missing), false);
      await rollback(async (trx) => {
        await trx.deleteFrom("asset_version_resource").where("asset_version_id", "=", f.versions.shared1).execute();
        assert.equal(await retention.isKeyProtected(trx, f.keys.shared), true, "another tenant still retains the physical key");
      }, "purge");
      const protectedKeys = await retention.collectProtectedKeys();
      assert.ok(protectedKeys.has(f.keys.audio.replace(/\.webm$/, ".m4a")));
      const report = await retention.releaseObjectsIfUnreferenced([f.keys.shared, f.keys.missing], { method: "TEST", path: "services-regression" });
      assert.deepEqual(report.removed, []);
      assert.deepEqual(report.failed, []);
      assert.deepEqual(report.kept, [f.keys.shared]);
      assert.deepEqual(report.candidates, [f.keys.missing]);
    });

    await check("T09 audio source and derived-file reuse share one lock domain", async () => {
      await rollback(async (trx) => {
        await retention.lockObjectKeys(trx, [f.keys.concurrentAudio]);
        await client.query("begin");
        try {
          const result = await client.query<{ acquired: boolean }>("select pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired",
            [`object-key:${f.keys.concurrentAudio.replace(/\.webm$/, ".m4a")}`]);
          assert.equal(result.rows[0].acquired, false, "holding the source key must also serialize compatibility-file reuse/deletion");
        } finally { await client.query("rollback"); }
      });
    });

    await check("T17 direct stale legacy writes cannot modify cut-over content", async () => {
      await rejectSql("update asset set file_url='https://external-fixture.invalid/old-client.glb' where id=$1", [f.assets.shared], "55000");
      assert.equal((await sql<{ current_version_id: string }>`select current_version_id from asset where id=${f.assets.shared}::uuid`.execute(db)).rows[0].current_version_id, f.versions.shared2);
    });

    await check("T01/T02 asset service lists/details/usage enforce real project and tenant boundaries", async () => {
      const project = await assetService.listWorkspaceAssets(actors.editor, f.workspaces.b, {});
      assert.deepEqual(new Set(project.data.map((item) => item.id)), new Set([f.assets.shared, f.assets.restricted]));
      assert.ok(project.data.every((item) => item.capabilities.can_maintain === false));
      const detail = await assetService.getAssetDetail(actors.editor, f.assets.shared);
      assert.deepEqual(detail.versions.map((item) => item.version_no), [2, 1]);
      await rejectCode(() => assetService.getAssetDetail(actors.foreign, f.assets.shared), "NOT_FOUND");
      await rejectCode(() => assetService.getAssetUsage(actors.foreign, f.assets.shared), "NOT_FOUND");
      await rejectCode(() => assetService.listWorkspaceAssets(actors.unassigned, f.workspaces.b, {}), "FORBIDDEN");
      await rejectCode(() => assetService.listOrganizationAssets(actors.editor, f.organizations.team, { view: "all" }), "FORBIDDEN");
      await rejectCode(() => assetService.createAssetVersion(actors.editor, f.assets.shared, {
        payload: { kind: "model" }, resources: [{ role: "primary", externalUrl: "https://fixture.invalid/no.glb" }], idempotencyKey: `${f.run}-denied`,
      }), "FORBIDDEN");
    });

    await check("T05/T06 asset creation/version retries are idempotent and maintenance requires current lock", async () => {
      const body = { name: "idempotent model", fileType: "model", payload: { kind: "model" },
        resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/created.glb" }], idempotencyKey: `${f.run}-asset-create` };
      const first = await assetService.createAssetInWorkspace(actors.maintainer, f.workspaces.a, body);
      const replay = await assetService.createAssetInWorkspace(actors.maintainer, f.workspaces.a, body);
      assert.equal(first.created, true);
      assert.equal(replay.created, false);
      assert.equal(replay.asset.id, first.asset.id);
      assert.equal(replay.version.id, first.version.id);
      await rejectCode(() => assetService.createAssetInWorkspace(actors.maintainer, f.workspaces.a, { ...body, name: "different request" }), "IDEMPOTENCY_CONFLICT");
      await rejectCode(() => assetService.updateAssetIdentity(actors.maintainer, first.asset.id, { name: "missing lock" }), "LOCK_VERSION_REQUIRED");
      const changed = await assetService.updateAssetIdentity(actors.maintainer, first.asset.id, { name: "renamed", expectedLockVersion: first.asset.lock_version });
      assert.ok(changed.lock_version > first.asset.lock_version);
      await rejectCode(() => assetService.updateAssetIdentity(actors.maintainer, first.asset.id, { name: "stale", expectedLockVersion: first.asset.lock_version }), "LOCK_VERSION_CONFLICT");
      const newVersion = { payload: { kind: "model" }, resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/new.glb" }],
        idempotencyKey: `${f.run}-asset-version`, expectedLockVersion: changed.lock_version };
      const appended = await assetService.createAssetVersion(actors.maintainer, first.asset.id, newVersion);
      const retry = await assetService.createAssetVersion(actors.maintainer, first.asset.id, newVersion);
      assert.equal(appended.version.version_no, 2);
      assert.equal(retry.version.id, appended.version.id);
      assert.equal(retry.created, false);
      assert.equal((await assetService.getAssetDetail(actors.maintainer, first.asset.id)).versions.length, 2);
    });

    await check("T08 grant revocation blocks draft/revision/placement dependencies and succeeds only when unused", async () => {
      await rejectCode(() => assetService.revokeAssetGrant(actors.owner, f.assets.shared, f.workspaces.b), "DEPENDENCY_CONFLICT");
      await rejectCode(() => assetService.revokeAssetGrant(actors.editor, f.assets.shared, f.workspaces.b), "FORBIDDEN");
      await assetService.createAssetGrant(actors.maintainer, f.assets.shared, { workspaceId: f.workspaces.empty });
      assert.deepEqual(await assetService.revokeAssetGrant(actors.maintainer, f.assets.shared, f.workspaces.empty), { revoked: true });
      assert.equal((await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", f.assets.shared).where("workspace_id", "=", f.workspaces.empty).execute()).length, 0);
    });

    await check("T01/T08 generic resource reuse cannot bypass a restricted source's target-project grant", async () => {
      await rejectCode(() => assetService.createAssetInWorkspace(actors.editor, f.workspaces.empty, {
        name: "reuse must respect grant", fileType: "model", payload: { kind: "model" },
        resources: [{ role: "primary", fromVersionId: f.versions.restricted, fromRole: "primary" }], idempotencyKey: `${f.run}-source-grant-bypass`,
      }), "GRANT_REQUIRED");
    });

    await check("T08 archived source bytes cannot be imported through generic fromVersionId as new content", async () => {
      const duplicate = await assetService.duplicateAsset(actors.editor, f.assets.restricted, {
        targetWorkspaceId: f.workspaces.b, name: "archive source", idempotencyKey: `${f.run}-archive-source`,
      });
      const archived = await assetService.archiveAsset(actors.editor, duplicate.asset.id, duplicate.asset.lock_version);
      assert.equal(archived.asset.state, "archived");
      const retained = await assetService.getAssetDetail(actors.editor, duplicate.asset.id);
      assert.equal(retained.versions[0].id, duplicate.version.id);
      await rejectCode(() => assetService.createAssetInWorkspace(actors.editor, f.workspaces.b, {
        name: "archived resource bypass", fileType: "model", payload: { kind: "model" },
        resources: [{ role: "primary", fromVersionId: duplicate.version.id, fromRole: "primary" }], idempotencyKey: `${f.run}-archive-bypass`,
      }), "ARCHIVED");
    });

    await check("T02/T04/T05 Scene service pins two versions and serializes conflicting draft saves", async () => {
      const scene = await sceneService.createScene(actors.editor, f.workspaces.b, { name: "two-version composition" });
      assert.equal(scene.draft_document.schemaVersion, 3);
      assert.equal(scene.draft_document.content.durationSeconds, 10);
      assert.equal(scene.draft_document.content.loop, false);
      assert.deepEqual(scene.draft_document.content.assets, {});
      await rejectCode(() => sceneService.saveScene(actors.editor, scene.id, { name: "missing lock" }), "LOCK_VERSION_REQUIRED");
      const dual = versionedDocument(f.assets.shared, f.versions.shared1);
      dual.content.assets.newer = { assetId: f.assets.shared, assetVersionId: f.versions.shared2 };
      dual.content.instances.push({ ...(dual.content.instances[0] as Record<string, unknown>), id: "new-instance", asset: "newer" });
      const results = await Promise.allSettled([
        sceneService.saveScene(actors.editor, scene.id, { expectedLockVersion: scene.lock_version, document: dual, name: "left tab" }),
        sceneService.saveScene(actors.editor, scene.id, { expectedLockVersion: scene.lock_version, document: dual, name: "right tab" }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejected = results.find((result) => result.status === "rejected");
      assert.ok(rejected?.status === "rejected" && rejected.reason instanceof ContentError && rejected.reason.code === "LOCK_VERSION_CONFLICT");
      const saved = await sceneService.getScene(actors.editor, scene.id);
      assert.deepEqual(new Set(saved.referenced_resources.map((resource) => resource.asset_version_id)), new Set([f.versions.shared1, f.versions.shared2]));
      assert.equal(new Set(saved.referenced_resources.map((resource) => resource.url)).size, 2);
      await rejectCode(() => sceneService.getScene(actors.foreign, scene.id), "NOT_FOUND");
      assert.equal((await sceneService.getScene(actors.viewer, scene.id)).capabilities.can_edit, false);
      await rejectCode(() => sceneService.saveScene(actors.viewer, scene.id, { expectedLockVersion: saved.lock_version, name: "viewer write" }), "FORBIDDEN");
      const invalidClip = structuredClone(dual);
      invalidClip.content.instances[0] = { ...(invalidClip.content.instances[0] as Record<string, unknown>), animation: { clipIndex: 99, startSeconds: 0, loop: false } };
      await rejectCode(() => sceneService.saveScene(actors.editor, scene.id, { expectedLockVersion: saved.lock_version, document: invalidClip }), "VALIDATION_FAILED");
      assert.equal((await sceneService.getScene(actors.editor, scene.id)).lock_version, saved.lock_version, "failed clip validation cannot mutate the draft");
    });

    await check("T06 concurrent Scene publication freezes exact references once per source lock", async () => {
      const scene = await sceneService.createScene(actors.editor, f.workspaces.b, {
        name: "publish frozen draft", document: versionedDocument(f.assets.shared, f.versions.shared1),
      });
      const published = await Promise.all([
        sceneService.publishScene(actors.editor, scene.id, { expectedLockVersion: scene.lock_version }),
        sceneService.publishScene(actors.editor, scene.id, { expectedLockVersion: scene.lock_version }),
      ]);
      assert.equal(published[0].revision.id, published[1].revision.id);
      assert.equal(published.filter((item) => item.created).length, 1);
      assert.equal((await sceneService.listRevisions(actors.editor, scene.id)).length, 1);
      const fixed = await sceneService.loadRevisionForPlayback(db, published[0].revision.id);
      assert.equal(fixed?.resources[0].asset_version_id, f.versions.shared1);
      assert.ok(fixed?.resources[0].url?.endsWith("shared.glb"));
      const changed = await sceneService.saveScene(actors.editor, scene.id, {
        expectedLockVersion: scene.lock_version, document: versionedDocument(f.assets.shared, f.versions.shared2),
      });
      assert.equal(changed.publish_status, "modified");
      assert.equal((await sceneService.loadRevisionForPlayback(db, published[0].revision.id))?.resources[0].asset_version_id, f.versions.shared1);
      await rejectCode(() => sceneService.publishScene(actors.viewer, scene.id, { expectedLockVersion: changed.lock_version }), "FORBIDDEN");
    });

    await check("T08 concurrent restricted-grant revocation and new Scene reference never leave an ungranted dependency", async () => {
      const scene = await sceneService.createScene(actors.editor, f.workspaces.b, { name: "grant race" });
      const results = await Promise.allSettled([
        sceneService.saveScene(actors.editor, scene.id, { expectedLockVersion: scene.lock_version, document: versionedDocument(f.assets.restricted, f.versions.restricted) }),
        assetService.revokeAssetGrant(actors.owner, f.assets.restricted, f.workspaces.b),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1, "save or revoke may win, but both cannot succeed");
      const refs = await db.selectFrom("scene_asset_ref").select("asset_id").where("scene_id", "=", scene.id).execute();
      const grant = await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", f.assets.restricted).where("workspace_id", "=", f.workspaces.b).executeTakeFirst();
      assert.ok(!refs.length || !!grant, "every committed restricted reference retains its grant");
      if (!grant) await assetService.createAssetGrant(actors.owner, f.assets.restricted, { workspaceId: f.workspaces.b });
    });

    await check("T05/T07 publishing with placement updates cannot omit each placement's optimistic lock", async () => {
      const source = await sceneService.getScene(actors.maintainer, f.scenes.a);
      const changed = await sceneService.saveScene(actors.maintainer, source.id, { expectedLockVersion: source.lock_version, name: "new source draft" });
      const prior = await db.selectFrom("placement").select(["scene_revision_id", "lock_version"]).where("id", "=", f.placements.scene).executeTakeFirstOrThrow();
      await rejectCode(() => sceneService.publishScene(actors.maintainer, source.id, {
        expectedLockVersion: changed.lock_version, updatePlacementIds: [f.placements.scene],
      }), "LOCK_VERSION_REQUIRED");
      const after = await db.selectFrom("placement").select(["scene_revision_id", "lock_version"]).where("id", "=", f.placements.scene).executeTakeFirstOrThrow();
      assert.deepEqual(after, prior);
      const published = await sceneService.publishScene(actors.maintainer, source.id, {
        expectedLockVersion: changed.lock_version,
        updatePlacements: [{ placementId: f.placements.scene, expectedLockVersion: prior.lock_version }],
      });
      const updated = await db.selectFrom("placement").select(["scene_revision_id", "lock_version"]).where("id", "=", f.placements.scene).executeTakeFirstOrThrow();
      assert.equal(updated.scene_revision_id, published.revision.id);
      assert.equal(updated.lock_version, prior.lock_version + 1);
      assert.equal(published.updated_placements[0]?.id, f.placements.scene);
    });

    await check("T07 independent placements move/pause/copy/upgrade/archive without mutating their sibling or source", async () => {
      const first = await placementService.getPlacement(actors.editor, f.placements.first);
      const sibling = await placementService.getPlacement(actors.editor, f.placements.second);
      assert.equal(first.public_id, first.id);
      assert.equal(first.target.kind, "asset_version");
      await rejectCode(() => placementService.getPlacement(actors.foreign, first.id), "NOT_FOUND");
      await rejectCode(() => placementService.updatePlacement(actors.viewer, first.id, { expectedLockVersion: first.lock_version, status: "paused" }), "FORBIDDEN");
      await rejectCode(() => placementService.updatePlacement(actors.editor, first.id, { status: "paused" }), "LOCK_VERSION_REQUIRED");
      const moved = await placementService.updatePlacement(actors.editor, first.id, {
        expectedLockVersion: first.lock_version, location: { longitude: 121.6, latitude: 31.3, altitude: 4 }, status: "paused",
      });
      assert.equal(moved.status, "paused");
      assert.deepEqual(moved.location, { longitude: 121.6, latitude: 31.3, altitude: 4 });
      await rejectCode(() => placementService.updatePlacement(actors.editor, first.id, { expectedLockVersion: first.lock_version, status: "active" }), "LOCK_VERSION_CONFLICT");
      const copy = await placementService.copyPlacement(actors.editor, first.id, { idempotencyKey: `${f.run}-copy-placement` });
      const replay = await placementService.copyPlacement(actors.editor, first.id, { idempotencyKey: `${f.run}-copy-placement` });
      assert.equal(replay.placement.id, copy.placement.id);
      assert.equal(replay.created, false);
      assert.notEqual(copy.placement.id, first.id);
      assert.equal(copy.placement.public_id, copy.placement.id);
      assert.deepEqual(copy.placement.target, moved.target);
      const upgraded = await placementService.updatePlacement(actors.editor, copy.placement.id, {
        expectedLockVersion: copy.placement.lock_version, target: { kind: "asset_version", assetVersionId: f.versions.shared2 },
      });
      assert.ok(upgraded.target.kind === "asset_version" && upgraded.target.asset_version_id === f.versions.shared2);
      const archived = await placementService.archivePlacement(actors.editor, copy.placement.id, upgraded.lock_version);
      assert.equal(archived.status, "archived");
      assert.deepEqual(await placementService.getPlacement(actors.editor, f.placements.second), sibling);
      assert.ok((await assetService.getAssetDetail(actors.maintainer, f.assets.shared)).versions.some((version) => version.id === f.versions.shared1));
      assert.deepEqual((await placementService.getPlacement(actors.editor, first.id)).target, first.target);
    });

    await check("T05/T07 batch moves are atomic for stale locks and unauthorized projects", async () => {
      const one = await placementService.getPlacement(actors.editor, f.placements.first);
      const two = await placementService.getPlacement(actors.editor, f.placements.second);
      const move = (id: string, lock: number) => ({ placementId: id, expectedLockVersion: lock, longitude: 122, latitude: 32 });
      await rejectCode(() => placementService.movePlacements(actors.editor, { moves: [move(one.id, one.lock_version), move(two.id, two.lock_version + 99)] }), "LOCK_VERSION_CONFLICT");
      assert.deepEqual(await placementService.getPlacement(actors.editor, one.id), one);
      assert.deepEqual(await placementService.getPlacement(actors.editor, two.id), two);
      const source = await placementService.getPlacement(actors.maintainer, f.placements.scene);
      await rejectCode(() => placementService.movePlacements(actors.editor, { moves: [move(one.id, one.lock_version), move(source.id, source.lock_version)] }), "NOT_FOUND");
      assert.deepEqual(await placementService.getPlacement(actors.editor, one.id), one);
      const result = await placementService.movePlacements(actors.editor, { moves: [move(one.id, one.lock_version), move(two.id, two.lock_version)] });
      assert.equal(result.length, 2);
      assert.ok(result.every((item) => item.location?.longitude === 122 && item.location.latitude === 32));
    });

    await check("T02/T07 cross-project published Scenes need dual authority only for new or changed targets", async () => {
      const sourceAsset = await assetService.createAssetInWorkspace(actors.maintainer, f.workspaces.a, {
        name: "source-only restricted model", fileType: "model", visibility: "restricted", payload: { kind: "model" },
        resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/source-only.glb" }], idempotencyKey: `${f.run}-cross-scene-asset`,
      });
      const scene = await sceneService.createScene(actors.maintainer, f.workspaces.a, {
        name: "cross-project fixed work", document: versionedDocument(sourceAsset.asset.id, sourceAsset.version.id),
      });
      const revision = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version })).revision;
      const body = { target: { kind: "scene_revision", sceneRevisionId: revision.id }, location: { longitude: 121.5, latitude: 31.2 } };
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, body), "FORBIDDEN");
      await rejectCode(() => placementService.createPlacement(actors.maintainer, f.workspaces.b, body), "FORBIDDEN");
      const placed = await placementService.createPlacement(actors.owner, f.workspaces.b, body);
      await rejectCode(() => sceneService.getScene(actors.editor, scene.id), "NOT_FOUND");
      await rejectCode(() => assetService.getAssetDetail(actors.editor, sourceAsset.asset.id), "NOT_FOUND");
      assert.equal(await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", sourceAsset.asset.id).where("workspace_id", "=", f.workspaces.b).executeTakeFirst(), undefined);
      const moved = await placementService.updatePlacement(actors.editor, placed.placement.id, {
        expectedLockVersion: placed.placement.lock_version, location: { longitude: 121.7, latitude: 31.4 }, status: "paused", target: body.target,
      });
      assert.equal(moved.status, "paused");
      const newer = await sceneService.saveScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version, name: "later draft" });
      const next = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: newer.lock_version })).revision;
      await rejectCode(() => placementService.updatePlacement(actors.editor, moved.id, {
        expectedLockVersion: moved.lock_version, target: { kind: "scene_revision", sceneRevisionId: next.id },
      }), "FORBIDDEN");
      const changed = await placementService.updatePlacement(actors.owner, moved.id, {
        expectedLockVersion: moved.lock_version, target: { kind: "scene_revision", sceneRevisionId: next.id },
      });
      assert.ok(changed.target.kind === "scene_revision" && changed.target.scene_revision_id === next.id);
      await sceneService.saveScene(actors.maintainer, scene.id, { expectedLockVersion: newer.lock_version, state: "archived" });
      await rejectCode(() => placementService.createPlacement(actors.owner, f.workspaces.b, body), "ARCHIVED");
      const existing = await placementService.updatePlacement(actors.editor, changed.id, { expectedLockVersion: changed.lock_version, status: "active" });
      assert.equal(existing.status, "active");
      assert.ok((await sceneService.loadRevisionForPlayback(db, next.id))?.resources[0].url);
    });

    await check("T08 archived Asset keeps existing placement controls and fixed files but blocks new placements and copies", async () => {
      const asset = await assetService.createAssetInWorkspace(actors.editor, f.workspaces.b, {
        name: "archived placement source", fileType: "text", payload: { kind: "text", text: "retained" }, resources: [], idempotencyKey: `${f.run}-archive-placement-asset`,
      });
      const body = { target: { kind: "asset_version", assetVersionId: asset.version.id }, location: { longitude: 121, latitude: 31 } };
      const placed = await placementService.createPlacement(actors.editor, f.workspaces.b, body);
      await assetService.archiveAsset(actors.editor, asset.asset.id, asset.asset.lock_version);
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, body), "ARCHIVED");
      await rejectCode(() => placementService.copyPlacement(actors.editor, placed.placement.id, {}), "ARCHIVED");
      const changed = await placementService.updatePlacement(actors.editor, placed.placement.id, {
        expectedLockVersion: placed.placement.lock_version, target: body.target, status: "paused",
      });
      assert.equal(changed.status, "paused");
      assert.ok(changed.target.kind === "asset_version" && changed.target.asset_state === "archived");
      assert.equal((await assetService.getAssetDetail(actors.editor, asset.asset.id)).versions[0].payload.kind, "text");
    });

    await check("T10/T18 upload-and-place is atomic and idempotent; unlocated Shops remain directory placements", async () => {
      const body = { asset: { name: "onsite text", fileType: "text", payload: { kind: "text", text: "onsite" }, resources: [] },
        idempotencyKey: `${f.run}-onsite`, location: { longitude: 121, latitude: 31 } };
      const first = await placementService.createPlacement(actors.editor, f.workspaces.b, body);
      const retry = await placementService.createPlacement(actors.editor, f.workspaces.b, body);
      assert.ok(first.asset && first.version);
      assert.equal(first.placement.target.kind, "asset_version");
      assert.equal(retry.asset?.id, first.asset.id);
      assert.equal(retry.placement.id, first.placement.id);
      assert.equal(retry.created, false);
      const before = await db.selectFrom("asset").select("id").where("organization_id", "=", f.organizations.team).execute();
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, { ...body, idempotencyKey: `${f.run}-invalid-onsite`, location: null }), "VALIDATION_FAILED");
      assert.equal((await db.selectFrom("asset").select("id").where("organization_id", "=", f.organizations.team).execute()).length, before.length);
      const shop = await placementService.createPlacement(actors.editor, f.workspaces.b, { target: { kind: "asset_version", assetVersionId: f.versions.shop } });
      assert.equal(shop.placement.status, "active");
      assert.equal(shop.placement.location, null);
      assert.equal(shop.placement.directory_only, true);
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, { target: { kind: "asset_version", assetVersionId: f.versions.shared1 } }), "VALIDATION_FAILED");
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, { target: { kind: "asset_version", assetVersionId: f.versions.foreign }, status: "draft" }), "NOT_FOUND");
    });

    await check("T11/T18 legacy scope grants read-only current-revision copy with independent public ID", async () => {
      const scene = await sceneService.createScene(actors.maintainer, f.workspaces.a, { name: "legacy scope work", document: versionedDocument(f.assets.shared, f.versions.shared1) });
      const revision = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version })).revision;
      const original = (await placementService.createPlacement(actors.maintainer, f.workspaces.a, {
        target: { kind: "scene_revision", sceneRevisionId: revision.id }, location: { longitude: 121.5, latitude: 31.2 },
      })).placement;
      const publicId = randomUUID();
      const bindingId = randomUUID();
      await client.query("insert into legacy_runtime_binding(id,organization_id,public_id,placement_id) values($1,$2,$3,$4)", [bindingId, f.organizations.team, publicId, original.id]);
      for (const workspaceId of [f.workspaces.a, f.workspaces.b]) {
        await client.query("insert into legacy_content_map(binding_id,organization_id,public_id,workspace_id) values($1,$2,$3,$4)", [bindingId, f.organizations.team, publicId, workspaceId]);
      }
      const shared = await placementService.getPlacement(actors.editor, original.id, f.workspaces.b);
      assert.equal(shared.public_id, publicId);
      assert.equal(shared.capabilities.can_edit, false);
      assert.equal(shared.capabilities.can_copy, true);
      assert.equal(shared.capabilities.read_only_shared, true);
      await rejectCode(() => placementService.updatePlacement(actors.editor, original.id, { expectedLockVersion: shared.lock_version, status: "paused" }), "NOT_FOUND");
      await rejectCode(() => sceneService.getScene(actors.editor, scene.id), "NOT_FOUND");
      const copy = (await placementService.copyPlacement(actors.editor, original.id, { targetWorkspaceId: f.workspaces.b })).placement;
      assert.notEqual(copy.id, original.id);
      assert.equal(copy.public_id, copy.id);
      assert.deepEqual(copy.target, shared.target);
      assert.equal(copy.capabilities.can_edit, true);
      assert.equal((await placementService.listOrganizationPlacements(actors.owner, f.organizations.team)).filter((item) => item.public_id === publicId).length, 1);
      await client.query("update legacy_content_map set active=false where binding_id=$1 and workspace_id=$2", [bindingId, f.workspaces.b]);
      await rejectCode(() => placementService.getPlacement(actors.editor, original.id, f.workspaces.b), "NOT_FOUND");
      await rejectCode(() => placementService.copyPlacement(actors.editor, original.id, { targetWorkspaceId: f.workspaces.b }), "NOT_FOUND");
      assert.equal((await placementService.getPlacement(actors.editor, copy.id)).target.kind, "scene_revision");
    });

    await check("T11 runtime discovers only active fixed content in valid scopes, with stable legacy IDs", async () => {
      const oldUrl = "https://external-fixture.invalid/runtime-v1.glb";
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: { kind: "model" },
        resources: [{ role: "primary", url: oldUrl }], renderConfig: { is_huge: true, config: { scale_multiplier: 2 } }, sharedWithB: true });
      const newer = await assetService.createAssetVersion(actors.maintainer, ids.asset, {
        payload: { kind: "model" }, resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/runtime-v2.glb" }], idempotencyKey: `${f.run}-runtime-newer`,
      });
      assert.notEqual(newer.version.id, ids.version);
      const scopeA = { workspaceId: f.workspaces.a, organizationId: f.organizations.team };
      const scopeB = { workspaceId: f.workspaces.b, organizationId: f.organizations.team };
      const listed = await runtime.nearbyPlacements(scopeB, 31.2, 121.5, 50);
      assert.equal(listed.filter((item) => item.id === ids.public).length, 1);
      assert.equal(listed.find((item) => item.id === ids.public)?.file_url, oldUrl);
      assert.equal((await runtime.hugePlacements(scopeB)).find((item) => item.id === ids.public)?.file_url, oldUrl);
      assert.equal((await runtime.nearbyPlacements({ workspaceId: null, organizationId: f.organizations.team }, 31.2, 121.5, 50)).filter((item) => item.id === ids.public).length, 1);
      assert.equal((await runtime.nearbyPlacements({ workspaceId: f.workspaces.b, organizationId: f.organizations.foreign }, 31.2, 121.5, 50)).length, 0);
      assert.equal(await runtime.scopeState({ workspaceId: f.workspaces.b, organizationId: f.organizations.foreign }), null);
      await assetService.archiveAsset(actors.maintainer, ids.asset, newer.asset.lock_version);
      assert.equal((await runtime.nearbyPlacements(scopeA, 31.2, 121.5, 50)).find((item) => item.id === ids.public)?.file_url, oldUrl);
      await client.query("update legacy_content_map set active=false where binding_id=$1 and workspace_id=$2", [ids.binding, f.workspaces.b]);
      assert.equal((await runtime.nearbyPlacements(scopeB, 31.2, 121.5, 50)).some((item) => item.id === ids.public), false);
      assert.equal((await runtime.nearbyPlacements(scopeA, 31.2, 121.5, 50)).some((item) => item.id === ids.public), true);
      const placed = await placementService.getPlacement(actors.maintainer, ids.placement);
      await placementService.updatePlacement(actors.maintainer, ids.placement, { expectedLockVersion: placed.lock_version, status: "paused" });
      assert.equal((await runtime.nearbyPlacements(scopeA, 31.2, 121.5, 50)).some((item) => item.id === ids.public), false);
      assert.equal((await runtime.hugePlacements(scopeA)).some((item) => item.id === ids.public), false);
    });

    await check("T11 published manifest echoes discovery ID and keeps its frozen model when drafts change", async () => {
      const scene = await sceneService.createScene(actors.maintainer, f.workspaces.a, { name: "runtime published scene", document: versionedDocument(f.assets.shared, f.versions.shared1) });
      const revision = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version })).revision;
      const placement = (await placementService.createPlacement(actors.maintainer, f.workspaces.a, {
        target: { kind: "scene_revision", sceneRevisionId: revision.id }, location: { longitude: 121.5, latitude: 31.2 },
      })).placement;
      const publicId = randomUUID();
      const binding = randomUUID();
      await client.query("insert into legacy_runtime_binding(id,organization_id,public_id,placement_id) values($1,$2,$3,$4)", [binding, f.organizations.team, publicId, placement.id]);
      await client.query("insert into legacy_content_map(binding_id,organization_id,public_id,workspace_id) values($1,$2,$3,$4)", [binding, f.organizations.team, publicId, f.workspaces.b]);
      const scope = { workspaceId: f.workspaces.b, organizationId: f.organizations.team };
      await sceneService.saveScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version, document: versionedDocument(f.assets.shared, f.versions.shared2) });
      const manifest = await runtime.sceneManifest(publicId, scope);
      assert.equal(manifest.assetId, publicId);
      assert.ok(manifest.schemaVersion === 1 || manifest.schemaVersion === 2);
      assert.ok(manifest.resources.model.url.endsWith("shared.glb"));
      assert.equal(manifest.content.instances.length, 1);
      await assert.rejects(() => runtime.sceneManifest(placement.id, scope), runtime.RuntimeNotFound, "bound placements must resolve only their public compatibility ID");
      await assert.rejects(() => runtime.sceneManifest(publicId, { workspaceId: f.workspaces.empty, organizationId: f.organizations.team }), runtime.RuntimeNotFound);
      await assert.rejects(() => runtime.sceneManifest(publicId, { workspaceId: f.workspaces.b, organizationId: f.organizations.foreign }), runtime.RuntimeNotFound);
      await client.query("update legacy_content_map set active=false where binding_id=$1", [binding]);
      await assert.rejects(() => runtime.sceneManifest(publicId, scope), runtime.RuntimeNotFound);
    });

    await check("T11 migrated nested metadata survives the fixed-version runtime projection", async () => {
      const dimensions = { width: 3, height: 2, depth: 1 };
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: {
        kind: "model", attributes: { model_scale: 0.5 }, migration_legacy: { metadata: { dimensions, model_scale: 0.5 }, config: { scale_multiplier: 2 } },
      }, resources: [{ role: "primary", url: "https://external-fixture.invalid/migrated.glb" }], renderConfig: { config: { scale_multiplier: 2 } } });
      const projected = (await runtime.nearbyPlacements({ workspaceId: f.workspaces.a, organizationId: f.organizations.team }, 31.2, 121.5, 50)).find((item) => item.id === ids.public);
      assert.ok(projected);
      assert.deepEqual(projected.metadata.dimensions, dimensions, "migration_legacy nested metadata is immutable runtime data, not an optional UI field");
      assert.equal(projected.metadata.model_scale, 0.5);
      assert.equal(projected.config.scale_multiplier, 2);
    });

    await check("T11 migrated link projection retains the existing link consumer contract", async () => {
      const link = parseLinkAssetInput("https://www.figma.com/design/fixture/document");
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "link", payload: {
        kind: "link", url: link.originalUrl, migration_legacy: { metadata: {}, config: { link }, file_url: link.previewUrl },
      }, resources: [{ role: "primary", url: link.previewUrl }], renderConfig: { config: { link } } });
      const projected = (await runtime.nearbyPlacements({ workspaceId: f.workspaces.a, organizationId: f.organizations.team }, 31.2, 121.5, 50)).find((item) => item.id === ids.public);
      assert.ok(projected);
      assert.deepEqual(resolveLinkAssetData(projected.file_url, projected.config), link);
    });

    await check("T11 new link projection remains readable by the existing link consumer", async () => {
      const fresh = await placementService.createPlacement(actors.editor, f.workspaces.b, {
        asset: { name: "new link", fileType: "link", payload: { kind: "link", url: "https://example.test/article" }, resources: [] },
        idempotencyKey: `${f.run}-fresh-link`, location: { longitude: 121.5, latitude: 31.2 },
      });
      const current = (await runtime.nearbyPlacements({ workspaceId: f.workspaces.b, organizationId: f.organizations.team }, 31.2, 121.5, 50)).find((item) => item.id === fresh.placement.public_id);
      assert.ok(current);
      assert.deepEqual(resolveLinkAssetData(current.file_url, current.config), parseLinkAssetInput("https://example.test/article"));
    });

    await check("T11/T18 directory Shops and anchored content preserve compatibility resources and discovery paths", async () => {
      const shop = await seedRuntimeProjectionFixture(client, f, { kind: "shop", payload: { kind: "shop", text: "shop description", name: "old shop" }, location: false,
        resources: [{ role: "primary", url: "https://external-fixture.invalid/shop.jpg" }, { role: "checkin", url: "https://external-fixture.invalid/checkin.jpg" }], sharedWithB: true });
      const anchor = await seedRuntimeProjectionFixture(client, f, { kind: "anchor", payload: { kind: "anchor" }, location: false });
      const attached = await seedRuntimeProjectionFixture(client, f, { kind: "image", payload: { kind: "image" }, location: false, anchorId: anchor.asset,
        resources: [{ role: "primary", url: "https://external-fixture.invalid/anchored.jpg" }], sharedWithB: true });
      const scope = { workspaceId: f.workspaces.b, organizationId: f.organizations.team };
      const listed = (await runtime.shopPlacements(scope)).find((item) => item.id === shop.public);
      assert.ok(listed);
      assert.equal(listed.name, "old shop");
      assert.equal(listed.text_content, "shop description");
      assert.equal(listed.longitude, null);
      assert.equal(listed.latitude, null);
      assert.equal(listed.metadata.checkin_url, "https://external-fixture.invalid/checkin.jpg");
      assert.equal((await runtime.nearbyPlacements(scope, 31.2, 121.5, 50)).some((item) => item.id === shop.public || item.id === attached.public), false);
      assert.equal((await runtime.anchorPlacements(f.workspaces.b, anchor.asset)).find((item) => item.id === attached.public)?.file_url, "https://external-fixture.invalid/anchored.jpg");
      await client.query("update workspace set archived_at=now() where id=$1", [f.workspaces.a]);
      try {
        assert.equal((await runtime.shopPlacements(scope)).some((item) => item.id === shop.public), false, "archived canonical owner hides even shared scopes");
        assert.equal((await runtime.anchorPlacements(f.workspaces.b, anchor.asset)).some((item) => item.id === attached.public), false);
      } finally { await client.query("update workspace set archived_at=null where id=$1", [f.workspaces.a]); }
    });

    await check("T10 anonymous text preserves its existing submitter and grants no team catalog rights", async () => {
      await client.query("update users set email='dongming@user.com' where user_id=$1", [f.users.unassigned]);
      try {
        const placed = await runtime.submitAnonymousText({ content: "public message", workspaceId: f.workspaces.b, organizationId: f.organizations.team, lat: 31.2, lng: 121.5 });
        const projection = (await runtime.nearbyPlacements({ workspaceId: f.workspaces.b, organizationId: f.organizations.team }, 31.2, 121.5, 50)).find((item) => item.id === placed.id);
        assert.equal(projection?.text_content, "public message");
        const source = await db.selectFrom("placement as p").innerJoin("asset as a", "a.id", "p.asset_id").select(["a.id", "a.origin", "a.maintained_by", "a.created_by", "p.asset_version_id"]).where("p.id", "=", placed.id).executeTakeFirstOrThrow();
        assert.equal(source.origin, "public_submission");
        assert.equal(source.maintained_by, null);
        assert.equal(source.created_by, f.users.unassigned);
        assert.ok(source.asset_version_id);
        assert.equal((await assetService.listOrganizationAssets(actors.owner, f.organizations.team, {})).data.some((item) => item.id === source.id), false);
        await rejectCode(() => assetService.getAssetDetail(actors.unassigned, source.id), "NOT_FOUND");
        const unlocated = await runtime.submitAnonymousText({ content: "without GPS", workspaceId: f.workspaces.b, organizationId: f.organizations.team, lat: null, lng: null });
        assert.equal((await db.selectFrom("placement").select("status").where("id", "=", unlocated.id).executeTakeFirstOrThrow()).status, "draft");
        assert.equal((await runtime.nearbyPlacements({ workspaceId: f.workspaces.b, organizationId: f.organizations.team }, 31.2, 121.5, 50)).some((item) => item.id === unlocated.id), false);
      } finally { await client.query("update users set email=$2 where user_id=$1", [f.users.unassigned, `${f.run}-unassigned@example.test`]); }
    });

    await check("T14 anonymous submission rechecks the migration freeze after waiting for the organization lock", async () => {
      await client.query("update users set email='dongming@user.com' where user_id=$1", [f.users.unassigned]);
      let pending: Promise<PromiseSettledResult<unknown>> | undefined;
      await client.query("begin");
      try {
        await client.query("update organization set content_model_state='readonly' where id=$1", [f.organizations.team]);
        pending = runtime.submitAnonymousText({ content: "must not cross freeze", workspaceId: f.workspaces.b, organizationId: f.organizations.team, lat: 31.2, lng: 121.5 })
          .then((value): PromiseFulfilledResult<unknown> => ({ status: "fulfilled", value }), (reason): PromiseRejectedResult => ({ status: "rejected", reason }));
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const row = await client.query<{ waiting: boolean }>(`select exists(select 1 from pg_stat_activity where datname=current_database()
            and pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%organization%') waiting`);
          if (row.rows[0].waiting) { waiting = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(waiting, true, "submission must be observed waiting behind the migration organization lock");
        await client.query("commit");
        const result = await pending;
        assert.equal(result.status, "rejected", "a submission blocked by freeze must re-read readonly state before inserting");
        if (result.status === "rejected") assert.ok(result.reason instanceof runtime.RuntimeUnavailable || result.reason instanceof ContentError);
      } finally {
        await client.query("rollback");
        if (pending) await pending;
        await client.query("update organization set content_model_state='v2' where id=$1", [f.organizations.team]);
        await client.query("update users set email=$2 where user_id=$1", [f.users.unassigned, `${f.run}-unassigned@example.test`]);
      }
    });

    await check("T08 boundary-regression: retrying an older publication cannot retarget a placement after Scene archival", async () => {
      const scene = await sceneService.createScene(actors.maintainer, f.workspaces.a, {
        name: "archived publication retry", document: versionedDocument(f.assets.shared, f.versions.shared1),
      });
      const first = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version })).revision;
      const changed = await sceneService.saveScene(actors.maintainer, scene.id, {
        expectedLockVersion: scene.lock_version, document: versionedDocument(f.assets.shared, f.versions.shared2),
      });
      const second = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: changed.lock_version })).revision;
      assert.notEqual(first.id, second.id);
      const placed = (await placementService.createPlacement(actors.maintainer, f.workspaces.a, {
        target: { kind: "scene_revision", sceneRevisionId: second.id }, location: { longitude: 121.5, latitude: 31.2 },
      })).placement;
      await sceneService.saveScene(actors.maintainer, scene.id, { expectedLockVersion: changed.lock_version, state: "archived" });
      const before = await placementService.getPlacement(actors.maintainer, placed.id);
      let rejection: unknown;
      try {
        await sceneService.publishScene(actors.maintainer, scene.id, {
          expectedLockVersion: first.source_lock_version,
          updatePlacements: [{ placementId: placed.id, expectedLockVersion: before.lock_version }],
        });
      } catch (error) { rejection = error; }
      const after = await placementService.getPlacement(actors.maintainer, placed.id);
      assert.deepEqual(after.target, before.target, "archived Scene publication replay must leave Placement on R2, not retarget it to the existing R1");
      assert.equal(after.lock_version, before.lock_version);
      assert.ok(rejection instanceof ContentError && rejection.code === "ARCHIVED", "an existing revision does not bypass the Scene archived guard");
    });

    await check("T02 boundary-regression: same organization alone does not authorize an Anchor in a different project", async () => {
      const anchor = await seedRuntimeProjectionFixture(client, f, { kind: "anchor", payload: { kind: "anchor" }, location: false });
      await db.transaction().execute(async (trx) => {
        await declareWriter(trx, "v2");
        await trx.updateTable("asset").set({ workspace_id: [f.workspaces.a] }).where("id", "=", anchor.asset).execute();
      });
      assert.equal(await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", anchor.asset).where("workspace_id", "=", f.workspaces.b).executeTakeFirst(), undefined);
      assert.equal(await db.selectFrom("legacy_content_map").select("binding_id").where("binding_id", "=", anchor.binding).where("workspace_id", "=", f.workspaces.b).executeTakeFirst(), undefined);
      const permitted = await placementService.createPlacement(actors.maintainer, f.workspaces.a, {
        target: { kind: "asset_version", assetVersionId: f.versions.shared1 }, anchorId: anchor.asset,
      });
      assert.equal(permitted.placement.anchor_id, anchor.asset, "the Anchor is usable in its actual project A");
      const before = await db.selectFrom("placement").select("id").where("workspace_id", "=", f.workspaces.b).execute();
      let rejection: unknown;
      try {
        await placementService.createPlacement(actors.editor, f.workspaces.b, {
          target: { kind: "asset_version", assetVersionId: f.versions.shared1 }, anchorId: anchor.asset,
        });
      } catch (error) { rejection = error; }
      const after = await db.selectFrom("placement").select("id").where("workspace_id", "=", f.workspaces.b).execute();
      assert.equal(after.length, before.length, "project B must not gain an anchored Placement without an Anchor scope/grant");
      assert.ok(rejection instanceof ContentError, "unauthorized Anchor use must be rejected by the service");
    });

    await check("T02 probe-content-regression: hash probes cannot disclose restricted content or another actor's upload lease", async () => {
      const target = await access.requireWorkspaceEdit(db, actors.editor, f.workspaces.b);
      const targetWithoutGrant = await access.requireWorkspaceEdit(db, actors.editor, f.workspaces.empty);
      const sourceProject = await access.requireWorkspaceEdit(db, actors.maintainer, f.workspaces.a);
      assert.equal(await receipts.findProbeKey(db, actors.editor, target, `hash-${f.versions.shared1}`), f.keys.shared, "readable published history remains discoverable by its own hash");
      assert.equal(await receipts.findProbeKey(db, actors.editor, target, `hash-${f.versions.restricted}`), f.keys.restricted, "target project's existing grant permits hash lookup");
      assert.equal(await receipts.findProbeKey(db, actors.editor, targetWithoutGrant, `hash-${f.versions.restricted}`), null, "reading the restricted asset elsewhere cannot bypass the target-project use grant");
      assert.equal(await receipts.findProbeKey(db, actors.editor, target, `hash-${f.versions.foreign}`), null);
      assert.equal(await receipts.findProbeKey(db, actors.editor, target, `receipt-${f.receipts.active}`), null, "another actor's uncommitted upload is not a readable version");
      assert.equal(await receipts.findProbeKey(db, actors.maintainer, sourceProject, `receipt-${f.receipts.active}`), f.keys.lease, "own valid receipt remains reusable");
      assert.equal(await receipts.findProbeKey(db, actors.maintainer, sourceProject, `receipt-${f.receipts.expired}`), null);
      const privateHash = `${f.run}-private-hash`;
      const privateAsset = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: { kind: "model" }, sharedWithB: true,
        resources: [{ role: "primary", storageKey: `assets/${f.run}/private-preview.glb`, contentHash: privateHash }] });
      assert.equal(await receipts.findProbeKey(db, actors.editor, target, privateHash), null, "a legacy placement scope does not confer hash probe or source use rights");
      assert.equal(await receipts.findProbeKey(db, actors.maintainer, sourceProject, privateHash), `assets/${f.run}/private-preview.glb`);
      await rejectCode(() => assetService.getAssetDetail(actors.editor, privateAsset.asset), "NOT_FOUND");
    });

    await check("T02 probe-content-regression: shared Asset Placement exposes only its pinned content, without catalog/history/new-use grants", async () => {
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: { kind: "model", attributes: { label: "fixed-v1" }, migration_legacy: { metadata: { private_migration_note: "do not expose" } } },
        resources: [{ role: "primary", url: "https://external-fixture.invalid/fixed-preview-v1.glb" }], sharedWithB: true });
      const newest = await assetService.createAssetVersion(actors.maintainer, ids.asset, {
        payload: { kind: "model", attributes: { label: "private-v2" } }, resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/private-preview-v2.glb" }],
        idempotencyKey: `${f.run}-private-preview-version`,
      });
      const fixed = await placementService.getPlacementContent(actors.editor, ids.placement, f.workspaces.b);
      assert.equal(fixed.kind, "asset_version");
      if (fixed.kind !== "asset_version") throw new Error("Expected fixed AssetVersion content");
      assert.equal(fixed.placement_id, ids.placement);
      assert.equal(fixed.public_id, ids.public);
      assert.equal(fixed.asset_version_id, ids.version);
      assert.equal(fixed.version_no, 1);
      assert.equal(fixed.resources[0].url, "https://external-fixture.invalid/fixed-preview-v1.glb");
      assert.equal(fixed.payload.attributes?.label, "fixed-v1");
      for (const forbidden of ["migration_legacy", "current_version_id", "versions", "grants", newest.version.id, "private-v2"]) assert.equal(JSON.stringify(fixed).includes(forbidden), false, forbidden);
      assert.equal((await placementService.getPlacementContent(actors.viewer, ids.placement, f.workspaces.b)).kind, "asset_version", "project viewers can preview their shared placement");
      await rejectCode(() => assetService.getAssetDetail(actors.editor, ids.asset), "NOT_FOUND");
      await rejectCode(() => assetService.getAssetUsage(actors.editor, ids.asset), "NOT_FOUND");
      assert.equal((await assetService.listWorkspaceAssets(actors.editor, f.workspaces.b, {})).data.some((asset) => asset.id === ids.asset), false);
      await rejectCode(() => assetService.duplicateAsset(actors.editor, ids.asset, { targetWorkspaceId: f.workspaces.b, idempotencyKey: `${f.run}-no-source-duplicate` }), "NOT_FOUND");
      await rejectCode(() => placementService.createPlacement(actors.editor, f.workspaces.b, {
        target: { kind: "asset_version", assetVersionId: ids.version }, location: { longitude: 121.5, latitude: 31.2 },
      }), "GRANT_REQUIRED");
      await rejectCode(() => assetService.createAssetInWorkspace(actors.editor, f.workspaces.b, {
        name: "must not infer reuse rights", fileType: "model", payload: { kind: "model" },
        resources: [{ role: "primary", fromVersionId: ids.version, fromRole: "primary" }], idempotencyKey: `${f.run}-no-source-bytes`,
      }), "FORBIDDEN");
      assert.equal(await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", ids.asset).where("workspace_id", "=", f.workspaces.b).executeTakeFirst(), undefined);
      for (const viewer of [undefined, f.workspaces.empty, f.workspaces.foreign, randomUUID()]) {
        await rejectCode(() => placementService.getPlacementContent(actors.editor, ids.placement, viewer), "NOT_FOUND");
      }
      await rejectCode(() => placementService.getPlacementContent(actors.foreign, ids.placement, f.workspaces.b), "NOT_FOUND");
      await client.query("update legacy_content_map set active=false where binding_id=$1 and workspace_id=$2", [ids.binding, f.workspaces.b]);
      await rejectCode(() => placementService.getPlacementContent(actors.editor, ids.placement, f.workspaces.b), "NOT_FOUND");
    });

    await check("T02 probe-content-regression: shared Scene Placement preview returns frozen revision resources without draft access", async () => {
      const asset = await assetService.createAssetInWorkspace(actors.maintainer, f.workspaces.a, {
        name: "private scene model", fileType: "model", visibility: "restricted", payload: { kind: "model" },
        resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/fixed-scene-model.glb" }], idempotencyKey: `${f.run}-fixed-scene-model`,
      });
      const scene = await sceneService.createScene(actors.maintainer, f.workspaces.a, {
        name: "published preview", document: versionedDocument(asset.asset.id, asset.version.id),
      });
      const revision = (await sceneService.publishScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version })).revision;
      const placed = (await placementService.createPlacement(actors.maintainer, f.workspaces.a, {
        target: { kind: "scene_revision", sceneRevisionId: revision.id }, location: { longitude: 121.5, latitude: 31.2 },
      })).placement;
      const bindingId = randomUUID();
      const publicId = randomUUID();
      await client.query("insert into legacy_runtime_binding(id,organization_id,public_id,placement_id) values($1,$2,$3,$4)", [bindingId, f.organizations.team, publicId, placed.id]);
      await client.query("insert into legacy_content_map(binding_id,organization_id,public_id,workspace_id) values($1,$2,$3,$4)", [bindingId, f.organizations.team, publicId, f.workspaces.b]);
      const newest = await assetService.createAssetVersion(actors.maintainer, asset.asset.id, {
        payload: { kind: "model" }, resources: [{ role: "primary", externalUrl: "https://external-fixture.invalid/private-scene-model-new.glb" }], idempotencyKey: `${f.run}-private-scene-model-new`,
      });
      await sceneService.saveScene(actors.maintainer, scene.id, { expectedLockVersion: scene.lock_version, name: "unpublished secret name", document: versionedDocument(asset.asset.id, newest.version.id) });
      const fixed = await placementService.getPlacementContent(actors.editor, placed.id, f.workspaces.b);
      assert.equal(fixed.kind, "scene_revision");
      if (fixed.kind !== "scene_revision") throw new Error("Expected fixed SceneRevision content");
      assert.equal(fixed.public_id, publicId);
      assert.equal(fixed.scene_revision_id, revision.id);
      assert.equal(fixed.name, "published preview");
      assert.equal(fixed.document.content.assets.model.assetVersionId, asset.version.id);
      assert.equal(fixed.resources[0].asset_version_id, asset.version.id);
      assert.equal(fixed.resources[0].url, "https://external-fixture.invalid/fixed-scene-model.glb");
      assert.equal(JSON.stringify(fixed).includes("unpublished secret name"), false);
      assert.equal(JSON.stringify(fixed).includes(newest.version.id), false);
      await rejectCode(() => sceneService.getScene(actors.editor, scene.id), "NOT_FOUND");
      await rejectCode(() => sceneService.listRevisions(actors.editor, scene.id), "NOT_FOUND");
      await rejectCode(() => assetService.getAssetDetail(actors.editor, asset.asset.id), "NOT_FOUND");
      await rejectCode(() => sceneService.copyScene(actors.editor, scene.id, { targetWorkspaceId: f.workspaces.b }), "NOT_FOUND");
      assert.equal(await db.selectFrom("asset_workspace_grant").select("asset_id").where("asset_id", "=", asset.asset.id).where("workspace_id", "=", f.workspaces.b).executeTakeFirst(), undefined);
    });

    await check("T02 probe-content-regression: explicit viewer-project context is validated even for the source owner", async () => {
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: { kind: "model" },
        resources: [{ role: "primary", url: "https://external-fixture.invalid/context.glb" }], sharedWithB: true });
      assert.equal((await placementService.getPlacementContent(actors.owner, ids.placement, f.workspaces.b)).kind, "asset_version");
      for (const invalidViewer of [f.workspaces.empty, f.workspaces.foreign, randomUUID()]) {
        await rejectCode(() => placementService.getPlacementContent(actors.owner, ids.placement, invalidViewer), "NOT_FOUND");
        await rejectCode(() => placementService.getPlacement(actors.owner, ids.placement, invalidViewer), "NOT_FOUND");
      }
    });

    await check("T12 probe-content-regression: deleting a staged legacy row removes memberships while retaining immutable shadows", async () => {
      const { retireStagedLegacyRow } = await import("../lib/assets/legacy.server");
      const key = `assets/${f.run}/staged-delete.glb`;
      const ids = await seedRuntimeProjectionFixture(client, f, { kind: "model", payload: { kind: "model" },
        resources: [{ role: "primary", storageKey: key }], sharedWithB: true });
      await client.query("update organization set content_model_state='preparing' where id=$1", [f.organizations.team]);
      try {
        await client.query("update asset set workspace_id=$2::uuid[],tag_ids=$3::uuid[],file_url=$4 where id=$1", [ids.asset, [f.workspaces.a, f.workspaces.b], [randomUUID()], `https://content-services.invalid/${key}`]);
        await rejectSql("delete from asset where id=$1", [ids.asset], "23503");
        await retireStagedLegacyRow(ids.asset);
        const row = (await client.query<{ workspace_id: string[]; tag_ids: string[]; current_version_id: string }>("select workspace_id,tag_ids,current_version_id from asset where id=$1", [ids.asset])).rows[0];
        assert.ok(row, "staged identity remains for explicit migration reconciliation");
        assert.deepEqual(row.workspace_id, []);
        assert.deepEqual(row.tag_ids, []);
        assert.equal(row.current_version_id, ids.version);
        assert.equal((await db.selectFrom("placement").select("asset_version_id").where("id", "=", ids.placement).executeTakeFirstOrThrow()).asset_version_id, ids.version);
        assert.ok((await dto.loadVersionDtos(db, [ids.version])).has(ids.version));
        assert.equal(await retention.isKeyProtected(db, key), true, "legacy delete must retain staged-version files");
      } finally { await client.query("update organization set content_model_state='v2' where id=$1", [f.organizations.team]); }
    });
  } finally {
    try { await cleanupServicesFixture(client, f); }
    finally { await Promise.all([client.end(), db.destroy()]); }
  }
  console.log(`${passed} service integration groups passed; ${failures.length} failed`);
  assert.ok(passed + failures.length > 0, "No test matched the requested filter");
  if (failures.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]") : "Service regression failed");
  process.exitCode = 1;
});
