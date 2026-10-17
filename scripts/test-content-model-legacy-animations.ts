/** Migration-only animation catalog regression; no database, environment files or network. */
import assert from "node:assert/strict";
import type { ModelAnimationInfo } from "../lib/content-model/contracts";
import { clipIssues } from "../lib/scene/compile";
import type { SceneDocumentV3 } from "../lib/scene/protocol";
import type { LegacyAsset } from "./migrate/content-model/audit";
import { legacyPayload } from "./migrate/content-model/staging";

const modelId = "10170000-0000-4000-8000-000000000101";
const modelUrl = "https://migration-fixture.invalid/assets/animated.glb";
const contentHash = "a".repeat(64);
const cachedClip = { index: 0, name: "CINEMA_4D_Main", durationSeconds: 3.866666555404663 };
const source: LegacyAsset = {
  id: modelId, name: "Cached animation model", file_type: "model", workspace_id: [],
  created_by: null, anchor_id: null, text_content: null, file_url: modelUrl,
  metadata: { gltf: { fileUrl: modelUrl, contentHash, animations: [cachedClip], warnings: [], unsupported: [] } },
  config: {}, location: null, tag_ids: [], is_huge: false, content_hash: contentHash,
};
const document: SceneDocumentV3 = {
  schemaVersion: 3,
  content: {
    kind: "composition", units: "meters", durationSeconds: 6, loop: false,
    assets: { model: { assetId: modelId, assetVersionId: "10170000-0000-4000-8000-000000000102" } },
    instances: [{ id: "animated-model", asset: "model", position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1], animation: { clipName: cachedClip.name, startSeconds: 0, loop: false } }],
  },
};
const animations = (asset: LegacyAsset) => legacyPayload(asset).animations as ModelAnimationInfo[] | undefined;
const withCache = (changes: Record<string, unknown>): LegacyAsset => ({
  ...source,
  metadata: { gltf: { ...(source.metadata!.gltf as Record<string, unknown>), ...changes } },
});

const before = structuredClone(source);
assert.deepEqual(animations(source), [{ index: 0, name: cachedClip.name, duration_seconds: cachedClip.durationSeconds }]);
assert.deepEqual(clipIssues(document, { model: animations(source) }), [], "a real cached clip remains usable by pinned-version validation");
const missingClip = structuredClone(document);
missingClip.content.instances[0].animation = { clipName: "missing", startSeconds: 0, loop: false };
assert.equal(clipIssues(missingClip, { model: animations(source) }).length, 1, "known migrated catalogs still reject missing clips");

const empty = animations(withCache({ animations: [] }));
assert.deepEqual(empty, [], "a parsed model without animations remains a known empty catalog");
assert.equal(clipIssues(document, { model: empty }).length, 1);
for (const metadata of [null, {}, { gltf: {} }]) {
  const unknown = animations({ ...source, metadata });
  assert.equal(unknown, undefined, "uncached models must not be guessed to have no animations");
  assert.deepEqual(clipIssues(document, { model: unknown }), []);
}
assert.deepEqual(animations(withCache({ animations: [{ index: 0, name: "Untimed" }] })), [{ index: 0, name: "Untimed" }]);
assert.deepEqual(animations(withCache({ animations: [{ index: 0, name: "Instant", durationSeconds: 0 }] })), [{ index: 0, name: "Instant", duration_seconds: 0 }]);
console.log("PASS cached animation timing and known/empty/unknown pinned-version clip validation");

for (const invalid of [
  withCache({ fileUrl: "https://migration-fixture.invalid/assets/stale.glb" }),
  withCache({ contentHash: "b".repeat(64) }),
  { ...source, content_hash: null },
  withCache({ animations: "not a parsed catalog" }),
  withCache({ animations: [cachedClip, { index: 1.5, name: "Invalid index" }] }),
  withCache({ animations: [{ index: 0, name: 123 }] }),
  withCache({ animations: [{ ...cachedClip, durationSeconds: -1 }] }),
  withCache({ animations: [{ ...cachedClip, durationSeconds: Number.POSITIVE_INFINITY }] }),
]) {
  assert.equal(animations(invalid), undefined, "stale or malformed caches remain unknown, never partial or known empty");
  assert.deepEqual((legacyPayload(invalid).migration_legacy as { metadata: unknown }).metadata, invalid.metadata);
}
assert.equal(animations({ ...source, file_type: "image" }), undefined, "only model payloads receive animation catalogs");
assert.deepEqual((legacyPayload(source).migration_legacy as { metadata: unknown }).metadata, before.metadata);
assert.deepEqual(source, before, "projection must not rewrite the frozen legacy cache");
console.log("PASS stale and malformed catalogs remain unknown; original legacy metadata is preserved");
