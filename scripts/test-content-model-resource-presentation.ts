/** Reference-image anchors must remain visible in the v2 management panels. */
import assert from "node:assert/strict";
import type { AssetVersionDto, AssetVersionResourceDto } from "../lib/content-model/contracts";
import { isFileMissing, primaryResource, thumbnailOf } from "../app/manage/lib/content-mappers";

const resource = (role: AssetVersionResourceDto["role"]): AssetVersionResourceDto => ({
  role, ordinal: 0, storage_key: null, external_url: `https://fixture.invalid/${role}.jpg`,
  url: `https://fixture.invalid/${role}.jpg`, managed: false,
  content_hash: null, mime_type: "image/jpeg", size_bytes: 100,
});
const version: AssetVersionDto = {
  id: "10170000-0000-4000-8000-000000000001",
  asset_id: "10170000-0000-4000-8000-000000000002",
  organization_id: "10170000-0000-4000-8000-000000000003",
  version_no: 1, payload_schema_version: 1, payload: { kind: "anchor" },
  resources: [resource("reference")], created_by: null, created_at: "2026-10-17T00:00:00Z",
};
assert.equal(primaryResource(version)?.url, "https://fixture.invalid/reference.jpg");
assert.equal(isFileMissing({ file_type: "anchor", current_version: version }), false);
assert.equal(primaryResource({ ...version, resources: [] }), null, "historical spatial anchors have no invented image");
assert.equal(primaryResource({ ...version, resources: [...version.resources, resource("primary")] })?.role, "primary");
assert.equal(thumbnailOf({ ...version, payload: { kind: "image" }, resources: [resource("primary"), resource("thumbnail")] }), "https://fixture.invalid/thumbnail.jpg");
assert.equal(primaryResource(null), null);
console.log("PASS reference-image anchors, missing historical references and primary/thumbnail precedence");
