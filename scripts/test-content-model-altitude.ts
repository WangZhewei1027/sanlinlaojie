/** In-memory migration regression; no database, environment files or network. */
import assert from "node:assert/strict";
import type { Client } from "pg";
import type { AssetMapping, LegacyAsset } from "./migrate/content-model/audit";
import type { MigrationOptions } from "./migrate/content-model/shared";
import { legacyAltitude, legacyPayload, stagePlacement } from "./migrate/content-model/staging";

const uuid = (n: number) => `10170000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = {
  organization_id: uuid(1), workspace_ids: [uuid(2)], target_id: uuid(3),
  source_workspace_id: uuid(2), maintained_by: null, create_placement: true,
};
const opts: MigrationOptions = { environment: "local", organizations: [uuid(1)], runId: uuid(4), apply: false };
const template: LegacyAsset = {
  id: uuid(3), name: "Altitude migration fixture", file_type: "text", workspace_id: [uuid(2)],
  created_by: null, anchor_id: null, text_content: "Preserve vertical position", file_url: null,
  metadata: null, config: {}, location: "POINT(121.5 31.2)", longitude: 121.5, latitude: 31.2,
  tag_ids: [], is_huge: false, content_hash: null,
};
const mapping: AssetMapping = {
  source_id: template.id, source_hash: "fixture", dependency_hash: "fixture", kind: "text",
  dependencies: [], issues: [], disposition: "migrate", targets: [target],
};

const cases: { name: string; metadata: LegacyAsset["metadata"]; expected: number | null }[] = [
  { name: "absent metadata", metadata: null, expected: null },
  { name: "absent height", metadata: {}, expected: null },
  { name: "legacy zero", metadata: { height: 0 }, expected: 0 },
  { name: "explicit altitude", metadata: { altitude: 35, height: 12 }, expected: 35 },
  { name: "explicit zero wins", metadata: { altitude: 0, height: 12 }, expected: 0 },
  { name: "negative altitude wins", metadata: { altitude: -2, height: 12 }, expected: -2 },
  { name: "null altitude falls back", metadata: { altitude: null, height: 12 }, expected: 12 },
  { name: "NaN altitude falls back", metadata: { altitude: NaN, height: 12 }, expected: 12 },
  { name: "infinite altitude falls back", metadata: { altitude: Infinity, height: 12 }, expected: 12 },
  { name: "negative infinite altitude falls back", metadata: { altitude: -Infinity, height: 12 }, expected: 12 },
  { name: "string altitude is not coerced", metadata: { altitude: "35", height: 12 }, expected: 12 },
  { name: "string height is not coerced", metadata: { height: "12" }, expected: null },
  { name: "empty text and booleans are not zero", metadata: { altitude: "", height: false }, expected: null },
  { name: "invalid numbers are not stored", metadata: { altitude: NaN, height: Infinity }, expected: null },
  { name: "valid altitude ignores invalid fallback", metadata: { altitude: 3, height: NaN }, expected: 3 },
  // Representative exact heights from the real legacy export, without source identities.
  { name: "exported audio height", metadata: { height: 2.7055564491461084 }, expected: 2.7055564491461084 },
  { name: "exported below-origin height", metadata: { height: -11.323307991027832 }, expected: -11.323307991027832 },
  { name: "exported high placement", metadata: { height: 102.03810216020793 }, expected: 102.03810216020793 },
  { name: "exported near-zero precision", metadata: { height: 9.313225746154785e-10 }, expected: 9.313225746154785e-10 },
];

async function main() {
  for (const test of cases) {
    const source: LegacyAsset = { ...template, metadata: test.metadata };
    const original = structuredClone(source);
    assert.equal(legacyAltitude(source), test.expected, test.name);
    let placementWrites = 0;
    const client = {
      async query(text: string, values: unknown[] = []) {
        if (text.startsWith("insert into placement(")) {
          placementWrites++;
          assert.equal(values[9], test.expected, `${test.name}: SQL must store the compatible altitude`);
          assert.equal(values[7], source.longitude);
          assert.equal(values[8], source.latitude);
        } else if (![
          "insert into content_migration_map(", "insert into legacy_runtime_binding(",
          "delete from legacy_content_map ", "delete from placement_tag ",
          "select id from tag ", "insert into legacy_content_map(",
        ].some((prefix) => text.startsWith(prefix))) {
          throw new Error(`Unexpected fixture query: ${text}`);
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Client;
    await stagePlacement(client, opts, mapping, target, source, uuid(5));
    assert.equal(placementWrites, 1, `${test.name}: exercise the actual staging path`);
    assert.deepEqual(source, original, `${test.name}: source metadata remains unchanged`);
    const payload = legacyPayload(source).migration_legacy as { metadata: unknown };
    assert.deepEqual(payload.metadata, test.metadata, `${test.name}: immutable payload retains original metadata`);
  }
  console.log(`PASS ${cases.length} altitude cases through actual placement staging, including legacy export examples`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Altitude migration regression failed");
  process.exitCode = 1;
});
