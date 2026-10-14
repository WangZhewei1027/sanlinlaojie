import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { parseSceneText, validateSceneDefinition, SceneAssetError } from "@/lib/scene/validate";
import { resolveModelRows, resolveSceneAsset, getSceneAsset } from "@/lib/scene/asset.server";
import { db, sql } from "@/lib/db";
import { POST as readSceneRoute } from "@/app/api/miniapp/assets/scene/route";
import type { SceneDefinition } from "@/lib/scene/protocol";

const modelId = randomUUID();
const workspaceId = randomUUID();
const definition: SceneDefinition = {
  schemaVersion: 1,
  content: {
    kind: "composition", units: "meters", durationSeconds: null, loop: false,
    assets: { dancer: { assetId: modelId } },
    instances: [{ id: "one", asset: "dancer", position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null }],
  },
};
const text = JSON.stringify(definition);
const model = { id: modelId, file_type: "model", file_url: "https://example.test/model.glb", workspace_id: [workspaceId] };
assert.deepEqual(parseSceneText(text), definition);
assert.throws(() => parseSceneText("not json"), SceneAssetError);
assert.throws(() => parseSceneText(" ".repeat(256 * 1024 + 1)), /256 KiB/);
const content = definition.content;
const instance = content.instances[0];
for (const invalid of [
  { ...definition, schemaVersion: 3 },
  ...[
    { ...content, kind: "single_asset" },
    { ...content, script: "run()" },
    { ...content, assets: { dancer: { assetId: "https://example.test/file.glb" } } },
    ...[
      { ...instance, asset: "missing" },
      { ...instance, quaternion: [0, 0, 0, 0] },
      { ...instance, scale: [-1, 1, 1] },
      { ...instance, animation: { clipIndex: 0, startSeconds: 0, loop: false } },
    ].map((item) => ({ ...content, instances: [item] })),
    { ...content, instances: Array.from({ length: 25 }, (_, i) => ({ ...instance, id: `i${i}` })) },
  ].map((item) => ({ ...definition, content: item })),
]) assert.equal(validateSceneDefinition(invalid).ok, false);
const animated = structuredClone(definition);
animated.content.durationSeconds = 10;
animated.content.instances[0].animation = { clipIndex: 0, startSeconds: 2, loop: true };
assert.equal(validateSceneDefinition(animated).ok, true);
assert.equal(resolveModelRows(definition, [workspaceId], [model]).dancer.url, model.file_url);
assert.throws(() => resolveModelRows(definition, [workspaceId], []), /不存在/);
assert.throws(() => resolveModelRows(definition, [randomUUID()], [model]), /工作空间/);
assert.throws(() => resolveModelRows(definition, [workspaceId, randomUUID()], [model]), /工作空间/);
assert.throws(() => resolveModelRows(definition, [workspaceId], [{ ...model, file_type: "scene" }]), /模型素材/);
assert.throws(() => resolveModelRows(definition, [workspaceId], [{ ...model, file_url: null }]), /模型素材/);
console.log("PASS scene JSON, budgets, transforms, animation structure, dependency type and workspace boundaries");

async function databaseSmoke() {
  loadEnvConfig(process.cwd());
  const url = new URL(process.env.DATABASE_URL || "");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Database smoke runs only against localhost");
  const orgId = randomUUID();
  const sceneId = randomUUID();
  try {
    await db.insertInto("organization").values({ id: orgId, name: `scene-asset-smoke-${orgId}` }).execute();
    await db.insertInto("workspace").values({ id: workspaceId, name: "Scene asset smoke", organization_id: orgId }).execute();
    await db.insertInto("asset").values(model).execute();
    await resolveSceneAsset(text, [workspaceId]);
    await db.insertInto("asset").values({ id: sceneId, file_type: "scene", text_content: text, workspace_id: [workspaceId], location: "POINT(121 31)" }).execute();
    const requestScene = (body: unknown) => readSceneRoute(new Request("http://localhost/api/miniapp/assets/scene", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    const response = await requestScene({ asset_id: sceneId, p_workspace_id: workspaceId, p_organization_id: orgId });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).assetId, sceneId);
    assert.equal((await requestScene({ asset_id: sceneId })).status, 400);
    assert.equal((await requestScene({ asset_id: "bad", p_workspace_id: workspaceId })).status, 400);
    assert.equal((await requestScene({ asset_id: sceneId, p_workspace_id: randomUUID() })).status, 404);
    const manifest = await getSceneAsset(sceneId, workspaceId, orgId);
    assert.equal(manifest.assetId, sceneId);
    assert.equal(manifest.resources.dancer.url, model.file_url);
    assert.equal((await getSceneAsset(sceneId, null, orgId)).assetId, sceneId);
    await assert.rejects(getSceneAsset(sceneId, randomUUID(), orgId), /不存在/);
    await assert.rejects(getSceneAsset(sceneId, workspaceId, randomUUID()), /不存在/);
    const nearby = await sql<{ id: string; file_type: string }>`select * from public.get_nearby_assets(31, 121, 20, ${workspaceId}::uuid, ${orgId}::uuid)`.execute(db);
    assert.ok(nearby.rows.some((a) => a.id === sceneId && a.file_type === "scene"));
    await db.updateTable("asset").set({ file_url: "https://example.test/replaced.glb" }).where("id", "=", modelId).execute();
    assert.equal((await getSceneAsset(sceneId, workspaceId, orgId)).resources.dancer.url, "https://example.test/replaced.glb");
    await db.updateTable("asset").set({ workspace_id: [] }).where("id", "=", modelId).execute();
    await assert.rejects(getSceneAsset(sceneId, workspaceId, orgId), /工作空间/);
    await db.deleteFrom("asset").where("id", "=", modelId).execute();
    await assert.rejects(getSceneAsset(sceneId, workspaceId, orgId), /不存在/);
    assert.ok(await db.selectFrom("asset").select("id").where("id", "=", sceneId).executeTakeFirst());
    console.log("PASS database create/read, existing nearby lookup, org/workspace scope, live replacement, moved/deleted dependency");
  } finally {
    await db.deleteFrom("asset").where("id", "in", [sceneId, modelId]).execute();
    await db.deleteFrom("workspace").where("id", "=", workspaceId).execute();
    await db.deleteFrom("organization").where("id", "=", orgId).execute();
    await db.destroy();
  }
}
if (process.argv.includes("--db")) databaseSmoke().catch((error) => { console.error(error); process.exitCode = 1; });
