import { createHash } from "node:crypto";
import type { Client } from "pg";
import type { AssetMapping, AuditReport, LegacyAsset } from "./audit";
import { canonical, fingerprint, readJson, UUID, type MigrationOptions } from "./shared";

export interface InventoryEntry {
  storage_key: string; exists: true; checked_at: string;
  content_hash?: string; mime_type?: string; size_bytes?: number;
}
export interface MigrationReview extends AuditReport {
  reviewed: true;
  review_notes: Record<string, string>;
  /** Explicit, including [] when all URLs are external. Never inferred from .env. */
  media_base_urls: string[];
  resource_inventory?: InventoryEntry[];
  additional_resources?: { source_id: string; role: "audio_compat"; url: string }[];
  retire_source_ids?: string[];
}
export type MappingTarget = AssetMapping["targets"][number];
export interface ResourceSnapshot {
  role: "primary" | "thumbnail" | "checkin" | "audio_compat" | "reference";
  ordinal: number; storage_key: string | null; external_url: string | null;
  content_hash: string | null; mime_type: string | null; size_bytes: number | null;
}

export function stableId(...parts: string[]): string {
  const hash = createHash("sha256").update(parts.join(":" )).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export function loadReview(opts: MigrationOptions): MigrationReview {
  if (!opts.input) throw new Error("--input must point to the explicitly reviewed audit JSON");
  const review = readJson<MigrationReview>(opts.input);
  if (review.format !== "content-model-audit-v1" || review.reviewed !== true || !review.review_notes || !Array.isArray(review.media_base_urls))
    throw new Error("Review must set reviewed=true, review_notes and explicit media_base_urls (possibly [])");
  if (review.run_id !== opts.runId || review.environment !== opts.environment) throw new Error("Review run/environment does not match the command");
  if (canonical([...review.required_organizations].sort()) !== canonical(opts.organizations)) throw new Error("Select the complete connected organization group from the audit");
  for (const base of review.media_base_urls) {
    const parsed = new URL(base);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.search || parsed.hash) throw new Error("Invalid media_base_urls entry");
  }
  return review;
}
export function reviewDigest(review: MigrationReview): string {
  const { generated_at: _generated, ...rest } = review;
  return fingerprint(rest);
}
export async function validateReview(client: Client, review: MigrationReview, current: AuditReport): Promise<void> {
  if (review.source_fingerprint !== current.source_fingerprint) throw new Error("SOURCE_DRIFT: re-audit, review and stage a new snapshot before continuing");
  if (canonical(review.required_organizations) !== canonical(current.required_organizations)) throw new Error("Organization dependency group changed");
  if (review.mappings.length !== current.mappings.length) throw new Error("Review must account for every source row");
  const known = new Map(current.mappings.map((m) => [m.source_id, m]));
  const ids = new Set<string>();
  const targetIds = new Set<string>();
  for (const mapping of review.mappings) {
    const source = known.get(mapping.source_id);
    if (!source || ids.has(mapping.source_id)) throw new Error("Unknown or repeated reviewed source");
    ids.add(mapping.source_id);
    if (mapping.source_hash !== source.source_hash || mapping.dependency_hash !== source.dependency_hash || mapping.kind !== source.kind || canonical(mapping.dependencies) !== canonical(source.dependencies)) throw new Error(`Source facts were edited: ${mapping.source_id}`);
    if (mapping.disposition === "isolate") {
      if (!review.review_notes[mapping.source_id]?.trim()) throw new Error(`Isolation needs an explicit reason: ${mapping.source_id}`);
      continue;
    }
    if (mapping.disposition !== "migrate" || source.disposition === "isolate") throw new Error(`Unresolved or invalid source: ${mapping.source_id}`);
    if (source.issues.includes("coordinate_reference_requires_review")) throw new Error("Repair the coordinate reference in the source and re-audit, or isolate it; a review note is not a coordinate conversion");
    if (mapping.kind === "anchor" && mapping.targets.length !== 1) throw new Error("Cross-organization anchors must be isolated; embedding identity cannot be split automatically");
    if (canonical(mapping.targets.map((t) => t.organization_id).sort()) !== canonical(source.targets.map((t) => t.organization_id).sort())) throw new Error("A reviewed mapping cannot drop, repeat or add an organization");
    if (!mapping.targets.some((t) => t.target_id === mapping.source_id)) throw new Error("Choose which organization retains the legacy identity");
    if (!["image","video","audio","document","model","text","link","shop","anchor","scene"].includes(mapping.kind)) throw new Error("Unsupported legacy type must be explicitly isolated");
    for (const target of mapping.targets) {
      const original = source.targets.find((t) => t.organization_id === target.organization_id);
      if (!original || canonical(target.workspace_ids) !== canonical(original.workspace_ids) || target.create_placement !== original.create_placement) throw new Error("A reviewed mapping cannot change legacy visibility");
      if (!target.target_id || !UUID.test(target.target_id) || targetIds.has(`${mapping.kind === "scene" ? "scene" : "asset"}:${target.target_id}`)) throw new Error("Every target needs a unique valid identity");
      targetIds.add(`${mapping.kind === "scene" ? "scene" : "asset"}:${target.target_id}`);
      if (source.targets.length === 1 && target.target_id !== mapping.source_id) throw new Error("Single-organization identities must retain their old ID");
      if ((target.create_placement || mapping.kind === "scene") && !target.source_workspace_id) throw new Error("Choose an explicit source project for the scene/placement");
      if (target.source_workspace_id && !target.workspace_ids.includes(target.source_workspace_id)) throw new Error("Source project must belong to the old scope");
      if (target.maintained_by) {
        const member = await client.query("select 1 from organization_member where organization_id=$1 and user_id=$2 and role in ('owner','admin','member')", [target.organization_id,target.maintained_by]);
        if (!member.rowCount) throw new Error("Maintainer must be a current non-viewer organization member");
      }
    }
    if (source.disposition === "review" && !review.review_notes[mapping.source_id]?.trim()) throw new Error("Reviewed ambiguity needs an explanatory note");
  }
  for (const assignment of current.assignments) if (assignment.issue && !review.review_notes[`assignment:${assignment.workspace_id}:${assignment.user_id}`]?.trim()) throw new Error("Anomalous assignment needs explicit quarantine acknowledgement");
}

export async function readSources(client: Client, review: MigrationReview): Promise<Map<string, LegacyAsset>> {
  const rows = (await client.query<LegacyAsset>(`select a.*, case when GeometryType(location)='POINT' then ST_X(location) end longitude,
    case when GeometryType(location)='POINT' then ST_Y(location) end latitude from asset a where id=any($1::uuid[])`, [review.mappings.map((m) => m.source_id)])).rows;
  return new Map(rows.map((row) => [row.id,row]));
}

export function managedKey(url: string, bases: string[]): string | null {
  for (const base of bases) {
    const normalized = base.replace(/\/+$/, "");
    if (!url.startsWith(`${normalized}/`)) continue;
    const suffix = url.slice(normalized.length + 1).split(/[?#]/)[0];
    const key = decodeURIComponent(suffix);
    if (!key || key.startsWith("/") || /(^|\/)\.\.($|\/)/.test(key) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(key)) throw new Error("Invalid managed storage key");
    return key;
  }
  return null;
}
export function enumerateResources(source: LegacyAsset, review: MigrationReview, verifyInventory = true): ResourceSnapshot[] {
  // Reviewed legacy spatial anchors may predate reference images; ordinary v2
  // anchor creation still requires one. Any existing image remains inventoried.
  if (["image","video","audio","document","model"].includes(source.file_type) && !source.file_url) throw new Error(`MISSING_PRIMARY_RESOURCE: ${source.id}; repair or explicitly isolate`);
  const resources: ResourceSnapshot[] = [];
  const add = (url: unknown, role: ResourceSnapshot["role"]) => {
    if (typeof url !== "string" || !url) return;
    if (!/^https?:\/\//i.test(url)) throw new Error(`Unsupported media URL in ${source.id}`);
    const key = managedKey(url, review.media_base_urls);
    if (resources.some((resource) => resource.role === role && (key ? resource.storage_key === key : resource.external_url === url))) return;
    const inventory = review.resource_inventory?.find((entry) => entry.storage_key === key);
    if (key && verifyInventory && (!inventory || inventory.exists !== true || !Number.isFinite(Date.parse(inventory.checked_at)) || (inventory.size_bytes !== undefined && (!Number.isInteger(inventory.size_bytes) || inventory.size_bytes < 0)))) throw new Error(`UNVERIFIED_RESOURCE: ${source.id} ${key}`);
    resources.push({role,ordinal:resources.filter((r) => r.role === role).length,storage_key:key,external_url:key ? null : url,content_hash:inventory?.content_hash ?? (role === "primary" ? source.content_hash : null),mime_type:inventory?.mime_type ?? null,size_bytes:inventory?.size_bytes ?? null});
  };
  if (source.file_type !== "link") add(source.file_url,source.file_type === "anchor" ? "reference" : "primary");
  const metadata = source.metadata ?? {};
  add(metadata.checkin_url,"checkin");
  add(metadata.thumbnail_url,"thumbnail");
  add(metadata.poster_url,"thumbnail");
  const link = source.config?.link;
  if (link && typeof link === "object" && !Array.isArray(link)) add((link as Record<string,unknown>).previewUrl,"thumbnail");
  if (source.file_type === "link" && source.file_url && source.file_url !== (link as Record<string,unknown> | null)?.originalUrl) add(source.file_url,"thumbnail");
  for (const extra of review.additional_resources ?? []) if (extra.source_id === source.id) add(extra.url,extra.role);
  const inspect = (value: unknown) => {
    if (typeof value === "string") for (const match of value.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
      const key=managedKey(match[0],review.media_base_urls);
      if(key && !resources.some((resource)=>resource.storage_key===key)) throw new Error(`UNCLASSIFIED_MANAGED_RESOURCE: ${source.id}; explicitly classify the legacy URL before migration`);
    }
    if (value && typeof value === "object") for (const child of Object.values(value)) inspect(child);
  };
  inspect(source.metadata); inspect(source.config); inspect(source.text_content);
  return resources;
}
