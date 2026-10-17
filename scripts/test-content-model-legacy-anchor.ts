/** In-memory migration regression; no database, environment files or network. */
import assert from "node:assert/strict";
import type { Client } from "pg";
import { auditSnapshot, type LegacyAsset } from "./migrate/content-model/audit";
import { enumerateResources, validateReview, type MigrationReview } from "./migrate/content-model/review";
import type { MigrationOptions } from "./migrate/content-model/shared";
import { legacyPayload } from "./migrate/content-model/staging";

const uuid = (n: number) => `10170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const organization = uuid(1), workspace = uuid(2), anchorId = uuid(3), childId = uuid(4);
const base = "https://migration-fixture.invalid";
const opts: MigrationOptions = { environment: "local", organizations: [organization], runId: uuid(5), apply: false };
const anchor: LegacyAsset = {
  id: anchorId, name: "Historical spatial anchor", file_type: "anchor", workspace_id: [workspace],
  created_by: null, anchor_id: null, text_content: "Original anchor description", file_url: null,
  metadata: { longitude: 121.5, latitude: 31.2, height: 0 }, config: {},
  location: "POINT(121.5 31.2)", location_type: "POINT", location_srid: 4326,
  longitude: 121.5, latitude: 31.2, tag_ids: [], is_huge: false, content_hash: null,
};
const child: LegacyAsset = {
  ...anchor, id: childId, name: "Attached text", file_type: "text", anchor_id: anchorId,
  text_content: "Content with no independent GPS", location: null, location_type: null,
  location_srid: null, longitude: null, latitude: null, metadata: {},
};

/** Only canned SELECTs are supported: an accidental query/write fails the test. */
function snapshotClient(assets: LegacyAsset[]): Client {
  return {
    async query(text: string) {
      if (text === "select id, organization_id from workspace") return { rows: [{ id: workspace, organization_id: organization }] };
      if (text.startsWith("select id from organization where")) return { rows: [{ id: organization }] };
      if (text === "select organization_id,user_id,role from organization_member") return { rows: [] };
      if (text.includes("to_regclass('public.content_migration_map')")) return { rows: [{ present: false }] };
      if (text.includes("from asset a")) return { rows: structuredClone(assets) };
      if (text.includes("information_schema.columns")) return { rows: [{ present: true }] };
      if (text.includes("from workspace_assignment wa")) return { rows: [] };
      if (text.includes("from pg_tables") || text.includes("from schema_migrations")) return { rows: [] };
      throw new Error(`Unexpected fixture query: ${text}`);
    },
  } as unknown as Client;
}

async function main() {
  const sources = [anchor, child];
  const original = structuredClone(sources);
  const client = snapshotClient(sources);
  const report = await auditSnapshot(client, opts);
  const anchorMapping = report.mappings.find((m) => m.source_id === anchorId)!;
  const childMapping = report.mappings.find((m) => m.source_id === childId)!;
  assert.equal(anchorMapping.disposition, "review", "an image-free historical anchor is reviewable, not fatal");
  assert.deepEqual(anchorMapping.issues, ["legacy_anchor_without_reference_requires_review"]);
  assert.equal(anchorMapping.targets[0].target_id, anchorId);
  assert.deepEqual(anchorMapping.targets[0].workspace_ids, [workspace]);
  assert.equal(anchorMapping.targets[0].source_workspace_id, workspace);
  assert.equal(anchorMapping.targets[0].create_placement, false, "anchor remains an identity, not display content");
  assert.equal(childMapping.disposition, "migrate");
  assert.deepEqual(childMapping.issues, []);
  assert.equal(childMapping.targets[0].target_id, childId);
  assert.equal(childMapping.targets[0].create_placement, true, "attachment alone preserves placement eligibility");

  const review: MigrationReview = {
    ...structuredClone(report), reviewed: true, review_notes: {}, media_base_urls: [base],
  };
  await assert.rejects(validateReview(client, review, report), /Unresolved or invalid source/);
  review.mappings.find((m) => m.source_id === anchorId)!.disposition = "migrate";
  await assert.rejects(validateReview(client, review, report), /Reviewed ambiguity needs an explanatory note/);
  review.review_notes[anchorId] = "Preserve historical spatial anchor and attachments; image matching remains missing_image until a reference is uploaded.";
  await validateReview(client, review, report);
  assert.deepEqual(enumerateResources(anchor, review), []);
  assert.deepEqual(enumerateResources(child, review), []);
  assert.equal(legacyPayload(anchor).text, anchor.text_content);
  assert.deepEqual(legacyPayload(anchor).migration_legacy, {
    metadata: anchor.metadata, config: anchor.config, text_content: anchor.text_content,
    name: anchor.name, file_url: null, is_huge: anchor.is_huge,
  });
  assert.deepEqual(sources, original, "audit/review must not rewrite historical anchor or child data");
  assert.equal(child.anchor_id, anchorId);
  console.log("PASS reviewed image-free anchor identity, scope, snapshot and attached placement mapping");

  const referenceAnchor = { ...anchor, file_url: `${base}/assets/reference.jpg` };
  const withReference = await auditSnapshot(snapshotClient([referenceAnchor, child]), opts);
  assert.equal(withReference.mappings[0].disposition, "migrate");
  assert.throws(() => enumerateResources(referenceAnchor, review), /UNVERIFIED_RESOURCE/);
  review.resource_inventory = [{ storage_key: "assets/reference.jpg", exists: true, checked_at: "2026-10-17T00:00:00Z" }];
  assert.deepEqual(enumerateResources(referenceAnchor, review), [{
    role: "reference", ordinal: 0, storage_key: "assets/reference.jpg", external_url: null,
    content_hash: null, mime_type: null, size_bytes: null,
  }]);
  for (const file_type of ["image", "model", "video", "audio", "document"]) {
    assert.throws(() => enumerateResources({ ...anchor, file_type }, review), /MISSING_PRIMARY_RESOURCE/, `${file_type} still needs its file`);
  }
  console.log("PASS existing anchor images require inventory; file-backed types still require primary media");

  const invalidAnchor = { ...anchor, longitude: 181 };
  const invalidReport = await auditSnapshot(snapshotClient([invalidAnchor, child]), opts);
  const invalidMapping = invalidReport.mappings.find((m) => m.source_id === anchorId)!;
  assert.equal(invalidMapping.disposition, "isolate", "the historical exception must not hide invalid coordinates");
  assert.ok(invalidMapping.issues.includes("invalid_gps_point"));
  const invalidReview: MigrationReview = { ...invalidReport, reviewed: true, review_notes: review.review_notes, media_base_urls: [] };
  invalidReview.mappings = structuredClone(invalidReport.mappings);
  invalidReview.mappings.find((m) => m.source_id === anchorId)!.disposition = "migrate";
  await assert.rejects(validateReview(client, invalidReview, invalidReport), /Unresolved or invalid source/);
  console.log("PASS invalid historical anchors cannot be forced through with a review note");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Historical anchor regression failed");
  process.exitCode = 1;
});
