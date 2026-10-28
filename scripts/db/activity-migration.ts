import { createHash } from "node:crypto";
import type { Client } from "pg";

export const ACTIVITY_MIGRATION = "20261028000000_independent_activities.sql";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ActivityTextReview {
  assetId: string;
  sourceHash: string;
  decision: "migrate" | "keep";
  reason: string;
}

export function parseActivityReview(value: unknown): ActivityTextReview[] {
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== "activity-text-review-v1" ||
    !("assets" in value) || !Array.isArray(value.assets)) throw new Error("Activity review requires format activity-text-review-v1 and an assets array");
  const ids = new Set<string>();
  return value.assets.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid activity review entry");
    const { assetId, sourceHash, decision, reason } = entry as Record<string, unknown>;
    if (typeof assetId !== "string" || !UUID.test(assetId) || ids.has(assetId.toLowerCase()) ||
      typeof sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(sourceHash) ||
      (decision !== "migrate" && decision !== "keep") || typeof reason !== "string" || !reason.trim()) {
      throw new Error("Invalid or duplicate activity review entry; each decision needs an asset ID, current fingerprint and reason");
    }
    ids.add(assetId.toLowerCase());
    return { assetId: assetId.toLowerCase(), sourceHash, decision, reason: reason.trim() };
  });
}

interface SourceRow {
  id: string;
  origin: string;
  source_json: string;
  proven_submission: boolean;
}

/** Fingerprints include every current placement/resource, so a review cannot silently
 * apply after content, visibility, ownership or usage has changed. Never infer public
 * authorship from the historical shared submission account or from text alone. */
export async function activityMigrationReport(client: Client) {
  const sources = (await client.query<SourceRow>(`
    select a.id, a.origin,
      (a.origin = 'public_submission' or exists (
        select 1 from content_audit_log l where l.action = 'placement.public_text'
        and l.organization_id = a.organization_id and l.details->>'asset_id' = a.id::text
      )) proven_submission,
      jsonb_build_object('asset',to_jsonb(a),
        'placements',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from placement p where p.asset_id=a.id),'[]'::jsonb),
        'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.role,r.ordinal) from asset_resource r where r.asset_id=a.id),'[]'::jsonb),
        'scene_refs',coalesce((select jsonb_agg(to_jsonb(r) order by r.scene_id,r.resource_alias) from scene_asset_ref r where r.asset_id=a.id),'[]'::jsonb),
        'tags',coalesce((select jsonb_agg(to_jsonb(t) order by t.placement_id,t.tag_id) from placement_tag t join placement p on p.id=t.placement_id where p.asset_id=a.id),'[]'::jsonb)
      )::text source_json
    from asset a where a.file_type='text' order by a.id
  `)).rows;
  const texts = sources.map((row) => ({
    assetId: row.id,
    sourceHash: createHash("sha256").update(row.source_json).digest("hex"),
    classification: row.proven_submission ? "public_submission" : row.origin === "legacy" ? "review_required" : "ordinary_asset",
    source: JSON.parse(row.source_json) as Record<string, unknown>,
  }));
  const shops = (await client.query(`select a.organization_id,p.workspace_id,count(*)::int count
    from asset a left join placement p on p.asset_id=a.id where a.file_type='shop'
    group by a.organization_id,p.workspace_id order by a.organization_id,p.workspace_id`)).rows;
  return { format: "activity-migration-audit-v1", texts, shopGroups: shops };
}

/** Invoked inside the migrator's transaction before the SQL migration. */
export async function prepareActivityMigration(client: Client, review: ActivityTextReview[] = []): Promise<void> {
  await client.query("lock table organization, workspace, asset, asset_resource, placement, placement_tag, scene_asset_ref, content_audit_log in access exclusive mode");
  const report = await activityMigrationReport(client);
  const entries = new Map(review.map((entry) => [entry.assetId, entry]));
  for (const entry of review) {
    const source = report.texts.find((item) => item.assetId === entry.assetId);
    if (!source || source.classification !== "review_required" || source.sourceHash !== entry.sourceHash) {
      throw new Error(`Activity review is stale or not applicable for ${entry.assetId}; rerun activity-preflight before migrating`);
    }
  }
  const missing = report.texts.filter((source) => source.classification === "review_required" && !entries.has(source.assetId));
  if (missing.length) throw new Error(`Activity migration requires explicit migrate/keep review for ${missing.length} legacy text asset(s), starting with ${missing.slice(0, 10).map((item) => item.assetId).join(", ")}. Run scripts/db/activity-preflight.ts.`);
  await client.query("create temporary table activity_text_classification(asset_id uuid primary key, decision text not null, source_hash text not null, reason text not null) on commit drop");
  for (const source of report.texts) {
    if (source.classification === "ordinary_asset") continue;
    const entry = entries.get(source.assetId);
    await client.query("insert into activity_text_classification values($1,$2,$3,$4)", [source.assetId, entry?.decision ?? "migrate", source.sourceHash,
      entry?.reason ?? "Existing public_submission origin or placement.public_text audit evidence"]);
  }
  // A managed URL can exist only in an old payload or render override. Preserve
  // those source-only references as well as explicit asset_resource rows.
  await client.query("create temporary table activity_archive_hold(storage_key text primary key) on commit drop");
  const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (baseUrl) {
    const base = new URL(baseUrl);
    const basePath = base.pathname.replace(/\/+$/, "");
    const rows = (await client.query<{ data: string }>(`select a.payload::text data from asset a
      where a.file_type='shop' or exists(select 1 from activity_text_classification c where c.asset_id=a.id and c.decision='migrate')
      union all select p.render_config::text from placement p join asset a on a.id=p.asset_id
      where a.file_type='shop' or exists(select 1 from activity_text_classification c where c.asset_id=a.id and c.decision='migrate')`)).rows;
    const keys = new Set<string>();
    for (const row of rows) for (const match of row.data.match(/https?:\/\/[^\s"'<>()\[\]{}]+/gi) ?? []) {
      try {
        const url = new URL(match);
        if (url.hostname.toLowerCase() !== base.hostname.toLowerCase() || (basePath && !url.pathname.startsWith(`${basePath}/`))) continue;
        const key = decodeURIComponent(url.pathname.slice(basePath.length).replace(/^\/+/, ""));
        if (key.startsWith("assets/")) keys.add(key);
      } catch { /* Malformed external text is not a managed file reference. */ }
    }
    for (const key of keys) await client.query("insert into activity_archive_hold values($1)", [key]);
  }
}
