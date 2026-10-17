import "server-only";
import { sql } from "@/lib/db";
import {
  ASSET_FILE_TYPES,
  RESOURCE_ROLES,
  type AssetDto,
  type AssetFileType,
  type AssetOrigin,
  type AssetState,
  type AssetContentDto,
  type AssetPayload,
  type AssetResourceDto,
  type AssetVisibility,
  type ResourceRole,
} from "@/lib/content-model/contracts";
import {
  assetAccessFrom,
  assetCapabilities,
  loadOrgAccess,
  type Actor,
  type AssetIdentity,
  type OrgAccess,
  type WorkspaceAccess,
} from "@/lib/content-model/access.server";
import { toIso, toIsoRequired, type Executor } from "@/lib/content-model/tx.server";
import { resourceUrl } from "./urls";

export const asFileType = (value: string): AssetFileType =>
  (ASSET_FILE_TYPES as readonly string[]).includes(value) ? (value as AssetFileType) : "document";
const asRole = (value: string): ResourceRole => ((RESOURCE_ROLES as readonly string[]).includes(value) ? (value as ResourceRole) : "primary");
const asVisibility = (value: string): AssetVisibility => (value === "organization" ? "organization" : "restricted");
const asState = (value: string): AssetState => (value === "archived" ? "archived" : "active");
const asOrigin = (value: string): AssetOrigin => (value === "team_upload" || value === "public_submission" ? value : "legacy");

/** Stored payloads were validated on write; the jsonb comes back parsed. */
export function payloadOf(value: unknown, fileType: AssetFileType): AssetPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as AssetPayload;
  return { kind: fileType } as AssetPayload;
}

export interface AssetRowFull extends AssetIdentity {
  create_at: Date | null;
  updated_at: Date;
  archived_at: Date | null;
}

export const ASSET_FULL_COLUMNS = [
  "asset.id",
  "asset.organization_id",
  "asset.name",
  "asset.file_type",
  "asset.visibility",
  "asset.state",
  "asset.origin",
  "asset.origin_workspace_id",
  "asset.maintained_by",
  "asset.lock_version",
  "asset.created_by",
  "asset.create_at",
  "asset.updated_at",
  "asset.archived_at",
] as const;

// ───────────────────────── contents ─────────────────────────

export async function loadAssetContents(exec: Executor, assetIds: string[]): Promise<Map<string, AssetContentDto>> {
  const ids = [...new Set(assetIds)];
  if (!ids.length) return new Map();
  // One statement gives each asset's payload and files the same DB snapshot.
  const rows = await exec.selectFrom("asset as a")
    .select(["a.id", "a.organization_id", "a.file_type", "a.payload", "a.lock_version", "a.updated_at",
      sql<unknown>`coalesce((select jsonb_agg(to_jsonb(r) order by r.role,r.ordinal) from asset_resource r where r.asset_id=a.id),'[]'::jsonb)`.as("resources")])
    .where("a.id", "in", ids).execute();
  return new Map(rows.map((a) => [a.id, {
    id: a.id, organization_id: a.organization_id, file_type: asFileType(a.file_type),
    payload: payloadOf(a.payload, asFileType(a.file_type)), lock_version: a.lock_version, updated_at: toIsoRequired(a.updated_at),
    resources: (a.resources as { role: string; ordinal: number; storage_key: string | null; external_url: string | null; content_hash: string | null; mime_type: string | null; size_bytes: number | null }[]).map((r) => ({
      ...r, role: asRole(r.role), url: resourceUrl(r), managed: r.storage_key !== null,
    })),
  }]));
}

export function primaryResource(content: AssetContentDto | undefined | null): AssetResourceDto | null {
  if (!content) return null;
  return content.resources.find((r) => r.role === "primary" && r.ordinal === 0)
    ?? content.resources.find((r) => r.role === "reference")
    ?? null;
}

// ───────────────────────── assets ─────────────────────────

/** Visible + restricted dependency count per asset (drafts + revisions + placements). */
async function usageCounts(exec: Executor, assetIds: string[]): Promise<Map<string, number>> {
  if (!assetIds.length) return new Map();
  const { rows } = await sql<{ asset_id: string; n: number }>`
    select asset_id, sum(n)::int as n from (
      select asset_id, count(*) as n from scene_asset_ref where asset_id = any(${assetIds}::uuid[]) group by asset_id
      union all
      select asset_id, count(*) from scene_revision_asset_ref where asset_id = any(${assetIds}::uuid[]) group by asset_id
      union all
      select asset_id, count(*) from placement where asset_id = any(${assetIds}::uuid[]) and status <> 'archived' group by asset_id
    ) t group by asset_id
  `.execute(exec);
  return new Map(rows.map((row) => [row.asset_id, Number(row.n)]));
}

/**
 * Asset DTOs with capability flags, current content and usage count. Rows of
 * organizations the caller does not belong to are dropped; inside the team
 * every asset is readable (visibility is metadata).
 */
export async function buildAssetDtos(
  exec: Executor,
  actor: Actor,
  rows: AssetRowFull[],
  opts: { usableIn?: WorkspaceAccess; orgAccess?: OrgAccess } = {},
): Promise<AssetDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const orgIds = [...new Set(rows.map((row) => row.organization_id))];
  const orgAccess = new Map<string, OrgAccess>();
  if (opts.orgAccess) orgAccess.set(opts.orgAccess.org.id, opts.orgAccess);
  for (const orgId of orgIds) {
    if (orgAccess.has(orgId)) continue;
    const access = await loadOrgAccess(exec, actor, orgId);
    if (access) orgAccess.set(orgId, access);
  }
  const maintainerIds = [...new Set(rows.map((row) => row.maintained_by).filter((id): id is string => !!id))];
  const [usage, contents, maintainers] = await Promise.all([
    usageCounts(exec, ids),
    loadAssetContents(exec, ids),
    maintainerIds.length
      ? exec.selectFrom("users").select(["user_id", "name", "email"]).where("user_id", "in", maintainerIds).execute()
      : Promise.resolve([]),
  ]);
  const maintainerById = new Map(maintainers.map((m) => [m.user_id, m]));
  const out: AssetDto[] = [];
  for (const row of rows) {
    const org = orgAccess.get(row.organization_id);
    if (!org) continue;
    const access = assetAccessFrom(org, row);
    if (!access.canRead) continue;
    const content = contents.get(row.id)!;
    // Any active team asset can be used in an open collection of the same team by a writer.
    const usable = opts.usableIn
      ? opts.usableIn.canEdit && opts.usableIn.workspace.organization_id === row.organization_id && row.state === "active"
      : undefined;
    const maintainer = row.maintained_by ? maintainerById.get(row.maintained_by) : undefined;
    out.push({
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      file_type: asFileType(row.file_type),
      origin: asOrigin(row.origin),
      visibility: asVisibility(row.visibility),
      state: asState(row.state),
      origin_workspace_id: row.origin_workspace_id,
      maintained_by: row.maintained_by,
      maintainer: maintainer ? { user_id: maintainer.user_id, name: maintainer.name, email: maintainer.email } : null,
      payload: content.payload,
      resources: content.resources,
      lock_version: content.lock_version,
      created_by: row.created_by,
      create_at: toIso(row.create_at),
      updated_at: content.updated_at,
      archived_at: toIso(row.archived_at),
      usage_count: usage.get(row.id) ?? 0,
      capabilities: assetCapabilities(access, usable),
    });
  }
  return out;
}

export async function loadAssetRows(exec: Executor, assetIds: string[]): Promise<AssetRowFull[]> {
  if (!assetIds.length) return [];
  const rows = await exec.selectFrom("asset").select(ASSET_FULL_COLUMNS).where("asset.id", "in", assetIds).where("asset.organization_id", "is not", null).execute();
  const byId = new Map(rows.map((row) => [row.id, row]));
  return assetIds
    .map((id) => byId.get(id))
    .filter((row): row is (typeof rows)[number] & { organization_id: string } => !!row && !!row.organization_id);
}

export async function loadAssetDto(exec: Executor, actor: Actor, assetId: string, opts: { usableIn?: WorkspaceAccess } = {}): Promise<AssetDto | null> {
  const rows = await loadAssetRows(exec, [assetId]);
  return (await buildAssetDtos(exec, actor, rows, opts))[0] ?? null;
}
