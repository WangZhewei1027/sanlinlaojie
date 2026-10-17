/** Pure regressions for team permissions, contracts and pinned scene playback. No DB or storage access. */
import assert from "node:assert/strict";
import { parseAssetPayload, parseRenderConfig, parseResourceInputs } from "../lib/content-model/payload";
import { hasOrgPermission, orgRoleCanWrite } from "../lib/permissions";
import { clipIssues, compileSceneManifest } from "../lib/scene/compile";
import { createBlankSceneDocument, type CompositionInstance } from "../lib/scene/protocol";
import { validateSceneDefinition, validateSceneDocument } from "../lib/scene/validate";

const uuid = (n: number) => `10150000-0000-4000-8000-${String(n).padStart(12, "0")}`;
assert.equal(orgRoleCanWrite("viewer"), false);
for (const role of ["owner", "admin", "member"]) {
  assert.equal(orgRoleCanWrite(role), true);
  assert.equal(hasOrgPermission(role, "org.collections.manage"), true, `${role} manages map collections`);
}
assert.equal(hasOrgPermission("viewer", "org.collections.manage"), false);
assert.equal(hasOrgPermission("member", "org.members.changeRole"), false, "team administration stays owner/admin");

console.log("PASS team roles drive collection access; assignments are ignored; viewers stay read-only");

const doc = createBlankSceneDocument();
doc.content.assets = {
  first: { assetId: uuid(1) },
  second: { assetId: uuid(1) },
};
const instance = (id: string, asset: string): CompositionInstance => ({
  id, asset, position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: null,
});
doc.content.instances = [instance("one", "first"), instance("two", "second")];
assert.equal(validateSceneDocument(doc).ok, true);
const invalid = structuredClone(doc) as unknown as { content: { assets: Record<string, Record<string, unknown>> } };
delete invalid.content.assets.second.assetId;
assert.equal(validateSceneDocument(invalid).ok, false, "draft requires a valid asset identity");
assert.equal(validateSceneDocument({ ...doc, schemaVersion: 3 }).ok, false, "old documents must be migrated, never adapted at runtime");
const legacyRef = structuredClone(doc) as unknown as { content: { assets: Record<string, Record<string, unknown>> } };
legacyRef.content.assets.first.assetVersionId = uuid(2);
assert.equal(validateSceneDocument(legacyRef).ok, false, "asset version references are rejected");
const resources = {
  first: { assetId: uuid(1), url: "https://fixture.invalid/model-v1.glb" },
  second: { assetId: uuid(1), url: "https://fixture.invalid/model-v1.glb" },
};
const before = JSON.stringify(doc);
const manifest = compileSceneManifest(uuid(7), doc, resources);
assert.equal(manifest.assetId, uuid(7), "manifest echoes the discovered placement/public ID");
assert.equal(manifest.resources.first.url, resources.first.url);
assert.equal(manifest.resources.second.url, resources.second.url, "aliases of the same identity resolve to the same current content");
assert.equal(manifest.schemaVersion, 2);
assert.equal(validateSceneDefinition({ schemaVersion: 1, content: manifest.content }).ok, false);
assert.equal(validateSceneDefinition({ schemaVersion: manifest.schemaVersion, content: manifest.content }).ok, true);
assert.equal(JSON.stringify(doc), before, "compilation does not rewrite the authoring document");
assert.throws(() => compileSceneManifest(uuid(7), doc, { first: resources.first }), /not resolved/);
doc.content.instances[0].tracks = { "position.x": [
  { time: 0, value: 0, handles: [0, 0, 1, 1], connectedRight: false },
  { time: 2, value: 3, handles: [0.1, 0.2, 0.8, 0.9], connectedRight: true },
] };
const timeline = compileSceneManifest(uuid(7), doc, resources);
assert.equal(timeline.schemaVersion, 2);
assert.deepEqual(timeline.content.instances[0].tracks, doc.content.instances[0].tracks);
assert.equal(validateSceneDefinition({ schemaVersion: timeline.schemaVersion, content: timeline.content }).ok, true);
console.log("PASS schema-4 asset aliases compile to current playback protocol, preserve tracks and public IDs");

doc.content.instances[0].animation = { clipName: "walk", startSeconds: 0, loop: true };
doc.content.instances[1].animation = { clipIndex: 1, startSeconds: 0, loop: false };
assert.deepEqual(clipIssues(doc, { first: [{ index: 0, name: "walk" }], second: [{ index: 1, name: "run" }] }), []);
assert.equal(clipIssues(doc, { first: [{ index: 0, name: "idle" }], second: [] }).length, 2);
assert.equal(clipIssues(doc, { first: [{ index: 0, name: "walk" }, { index: 1, name: "walk" }] }).length, 1);
assert.deepEqual(clipIssues(doc, {}), [], "legacy unknown clip metadata remains load-time validated");
console.log("PASS current-content clip validation rejects missing/ambiguous clips");

assert.throws(() => parseAssetPayload("model", { kind: "scene" }));
assert.throws(() => parseAssetPayload("model", { kind: "model", attributes: { x: Infinity } }));
assert.throws(() => parseResourceInputs("model", []));
assert.throws(() => parseResourceInputs("model", [{ role: "primary", receiptId: uuid(1), externalUrl: "https://fixture.invalid/a.glb" }]));
assert.throws(() => parseResourceInputs("text", [{ role: "primary", externalUrl: "https://fixture.invalid/a.glb" }]));
assert.throws(() => parseRenderConfig({ is_huge: true }, "scene"));
assert.throws(() => parseRenderConfig({ unknown: true }, "model"));
assert.deepEqual(parseAssetPayload("text", { kind: "text", text: "Hello" }), { kind: "text", text: "Hello" });
console.log("PASS payload kinds, resource-source exclusivity and placement override validation");
