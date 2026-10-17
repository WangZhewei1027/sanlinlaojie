import "server-only";
import { sql } from "@/lib/db";
import {
  ASSET_FILE_TYPES,
  RESOURCE_ROLES,
  type AssetDto,
  type AssetFileType,
  type AssetOrigin,
  type AssetState,
  type AssetVersionDto,
  type AssetVersionPayload,
  type AssetVersionResourceDto,
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
export function payloadOf(value: unknown, fileType: AssetFileType): AssetVersionPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as AssetVersionPayload;
  return { kind: fileType } as AssetVersionPayload;
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
  "asset.current_version_id",
  "asset.lock_version",
  "asset.created_by",
  "asset.create_at",
  "asset.updated_at",
  "asset.archived_at",
] as const;

// ───────────────────────── versions ─────────────────────────

export async function loadVersionDtos(exec: Executor, versionIds: string[]): Promise<Map<string, AssetVersionDto>> {
  const ids = [...new Set(versionIds)];
  if (!ids.length) return new Map();
  const [versions, resources] = await Promise.all([
    exec
      .selectFrom("asset_version as v")
      .innerJoin("asset as a", "a.id", "v.asset_id")
      .select(["v.id", "v.asset_id", "v.organization_id", "v.version_no", "v.payload_schema_version", "v.payload", "v.created_by", "v.created_at", "a.file_type"])
      .where("v.id", "in", ids)
      .execute(),
    exec
      .selectFrom("asset_version_resource")
      .selectAll()
      .where("asset_version_id", "in", ids)
      .orderBy("role")
      .orderBy("ordinal")
      .execute(),
  ]);
  const byVersion = new Map<string, AssetVersionResourceDto[]>();
  for (const row of resources) {
    const list = byVersion.get(row.asset_version_id) ?? [];
    list.push({
      role: asRole(row.role),
      ordinal: row.ordinal,
      storage_key: row.storage_key,
      external_url: row.external_url,
      url: resourceUrl(row),
      managed: row.storage_key !== null,
      content_hash: row.content_hash,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
    });
    byVersion.set(row.asset_version_id, list);
  }
  return new Map(
    versions.map((v) => [
      v.id,
      {
        id: v.id,
        asset_id: v.asset_id,
        organization_id: v.organization_id,
        version_no: v.version_no,
        payload_schema_version: v.payload_schema_version,
        payload: payloadOf(v.payload, asFileType(v.file_type)),
        resources: byVersion.get(v.id) ?? [],
        created_by: v.created_by,
        created_at: toIsoRequired(v.created_at),
      },
    ]),
  );
}

export function primaryResource(version: AssetVersionDto | undefined | null): AssetVersionResourceDto | null {
  if (!version) return null;
  return version.resources.find((r) => r.role === "primary" && r.ordinal === 0)
    ?? version.resources.find((r) => r.role === "reference")
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

/** Assets reachable through a grant to a project the caller is assigned to. */
async function grantReadable(exec: Executor, actor: Actor, assetIds: string[]): Promise<Set<string>> {
  if (!assetIds.length) return new Set();
  const rows = await exec
    .selectFrom("asset_workspace_grant as g")
    .innerJoin("workspace_assignment as a", "a.workspace_id", "g.workspace_id")
    .select("g.asset_id")
    .where("g.asset_id", "in", assetIds)
    .where("a.user_id", "=", actor.userId)
    .execute();
  return new Set(rows.map((row) => row.asset_id));
}

async function grantsIn(exec: Executor, workspaceId: string, assetIds: string[]): Promise<Set<string>> {
  if (!assetIds.length) return new Set();
  const rows = await exec
    .selectFrom("asset_workspace_grant")
    .select("asset_id")
    .where("workspace_id", "=", workspaceId)
    .where("asset_id", "in", assetIds)
    .execute();
  return new Set(rows.map((row) => row.asset_id));
}

/**
 * Asset DTOs with capability flags, current version and usage count. Rows
 * the caller cannot read are dropped (lists never leak restricted assets).
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
  const [grantRead, usage, versions, maintainers, usableGrants] = await Promise.all([
    grantReadable(exec, actor, ids),
    usageCounts(exec, ids),
    loadVersionDtos(exec, rows.map((row) => row.current_version_id).filter((id): id is string => !!id)),
    maintainerIds.length
      ? exec.selectFrom("users").select(["user_id", "name", "email"]).where("user_id", "in", maintainerIds).execute()
      : Promise.resolve([]),
    opts.usableIn ? grantsIn(exec, opts.usableIn.workspace.id, ids) : Promise.resolve(new Set<string>()),
  ]);
  const maintainerById = new Map(maintainers.map((m) => [m.user_id, m]));
  const out: AssetDto[] = [];
  for (const row of rows) {
    const org = orgAccess.get(row.organization_id);
    if (!org) continue;
    const access = assetAccessFrom(org, actor, row, grantRead.has(row.id));
    if (!access.canRead) continue;
    const version = row.current_version_id ? versions.get(row.current_version_id) ?? null : null;
    let usable: boolean | undefined;
    if (opts.usableIn) {
      const target = opts.usableIn;
      const isMaintainer = row.maintained_by === actor.userId && target.orgRole !== null;
      usable =
        target.canEdit &&
        target.workspace.organization_id === row.organization_id &&
        row.state === "active" &&
        (usableGrants.has(row.id) || row.visibility === "organization" || target.canAdminister || isMaintainer);
    }
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
      current_version_id: row.current_version_id,
      current_version_no: version?.version_no ?? null,
      current_version: version,
      lock_version: row.lock_version,
      created_by: row.created_by,
      create_at: toIso(row.create_at),
      updated_at: toIsoRequired(row.updated_at),
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
