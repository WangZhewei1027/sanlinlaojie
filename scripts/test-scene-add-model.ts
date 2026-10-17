import { normalizeDefinition, toV3, type EditorDefinition } from "@/app/manage/lib/scene-v3";
import { addModelInstance, resourceKey } from "@/app/manage/scenes/components/scene-add-model";
import type { SceneResource } from "@/app/manage/scenes/components/types";
import { COMPOSITION_LIMITS, createBlankScene } from "@/lib/scene/protocol";
import assert from "node:assert/strict";

const ASSET = "11111111-1111-4111-8111-111111111111";
const V1 = "22222222-2222-4222-8222-222222222222";
const V2 = "33333333-3333-4333-8333-333333333333";
const resource = (versionId: string, versionNo: number, extra: Partial<SceneResource> = {}): SceneResource => ({
  assetId: ASSET, assetVersionId: versionId, name: "小星星", url: `https://media.example/${versionId}.glb`, versionNo,
  currentVersionId: V2, currentVersionNo: 2, upgradeAvailable: false, assetState: "active", ...extra,
});
const blank = (schemaVersion: 3): EditorDefinition => ({ schemaVersion, content: { ...createBlankScene().content, assets: {} } });
let aliases = 0;
const createAlias = () => `m${++aliases}`;
let ids = 0;
/** Mirrors SceneEditor.addModel: the registered map is the render snapshot, `picked` is the clicked resource. */
function add(definition: EditorDefinition, key: string, registered: Record<string, SceneResource>, picked?: SceneResource) {
  const result = addModelInstance(definition.content, { key, resource: picked ?? registered[key], id: `model_${++ids}`, position: [0, 0, 0], createAlias });
  return result.ok ? { ok: true as const, definition: normalizeDefinition({ ...definition, content: result.content }) } : result;
}
const expectOk = (result: ReturnType<typeof add>) => { assert.ok(result.ok, `expected success, got ${!result.ok && result.reason}`); return result.definition; };

// First add from the project/shared library or an upload: the editor has not registered the resource yet.
const empty = blank(3);
const before = structuredClone(empty);
const first = expectOk(add(empty, V1, {}, resource(V1, 1)));
assert.deepEqual(empty, before, "the input document is never mutated");
assert.deepEqual(Object.values(first.content.assets), [{ assetId: ASSET, assetVersionId: V1 }], "first add pins the picked asset and version");
assert.equal(first.content.instances.length, 1);
assert.equal(first.content.assets[first.content.instances[0].asset].assetVersionId, V1);
assert.deepEqual(toV3(first).content.assets, first.content.assets, "the new draft serializes as schema 3 without unpinned aliases");

// The old flow read only the stale snapshot; without a picked resource, failure is graceful, not a TypeError.
assert.deepEqual(add(empty, V1, {}), { ok: false, reason: "missing" });
assert.deepEqual(add(empty, V1, {}, resource(V2, 2)), { ok: false, reason: "missing" }, "a resource for another version is never pinned under this key");
assert.deepEqual(add(empty, V1, {}, resource(V1, 1, { url: null })), { ok: false, reason: "missing" }, "a version without a file is not added");
assert.deepEqual(add(empty, "", {}, resource(V1, 1, { assetVersionId: null })), { ok: false, reason: "missing" });

// Repeating the same version (button, upload dedup or drag) reuses one alias.
const repeated = expectOk(add(first, V1, { [V1]: resource(V1, 1) }, resource(V1, 1)));
const repeatedFromDrop = expectOk(add(repeated, V1, {}));
assert.equal(Object.keys(repeatedFromDrop.content.assets).length, 1, "no duplicate alias for a repeated version");
assert.equal(new Set(repeatedFromDrop.content.instances.map((item) => item.asset)).size, 1);
assert.equal(repeatedFromDrop.content.instances.length, 3);

// Another version of the same asset coexists under its own alias.
const both = expectOk(add(repeatedFromDrop, V2, {}, resource(V2, 2)));
assert.deepEqual(Object.values(both.content.assets).map((ref) => ref.assetVersionId).sort(), [V1, V2].sort());
assert.equal(resourceKey(both.content.assets[both.content.instances[3].asset]), V2);

// Archived assets cannot be newly referenced, but existing references may gain instances.
assert.deepEqual(add(empty, V1, {}, resource(V1, 1, { assetState: "archived" })), { ok: false, reason: "archived" });
expectOk(add(first, V1, {}, resource(V1, 1, { assetState: "archived" })));

// Limits.
let full = blank(3);
for (let index = 0; index < COMPOSITION_LIMITS.maxInstances; index++) full = expectOk(add(full, V1, {}, resource(V1, 1)));
assert.deepEqual(add(full, V1, {}, resource(V1, 1)), { ok: false, reason: "instanceLimit" });
let many = blank(3);
const versions = Array.from({ length: COMPOSITION_LIMITS.maxAssets + 1 }, (_, index) => `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`);
for (const version of versions.slice(0, -1)) many = expectOk(add(many, version, {}, resource(version, 1)));
assert.deepEqual(add(many, versions.at(-1)!, {}, resource(versions.at(-1)!, 1)), { ok: false, reason: "assetLimit" });
expectOk(add(many, versions[0], {}));

console.log("PASS picked version, missing resource, shared alias, version coexistence, archived and limits");
