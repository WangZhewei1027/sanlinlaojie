import "server-only";
import { db, sql } from "@/lib/db";
import {
  ASSET_FILE_TYPES,
  SPECIAL_ASSET_FILE_TYPES,
  type ApiPage,
  type ArchiveAssetResult,
  type AssetDetailDto,
  type AssetDto,
  type AssetGrantDto,
  type AssetListQuery,
  type AssetOrigin,
  type AssetUsageDto,
  type AssetVisibility,
  type CreateAssetResult,
  type CreateVersionResult,
  type PlacementDto,
  type ResourceRole,
} from "@/lib/content-model/contracts";
import {
  ensureAssetUse,
  lockOrgForWrite,
  lockWorkspaceForWrite,
  readableWorkspaceIds,
  requireAssetMaintain,
  requireAssetRead,
  requireOrgRead,
  requireWorkspaceEdit,
  requireWorkspaceRead,
  type Actor,
  type WorkspaceAccess,
  loadWorkspaceAccess,
} from "@/lib/content-model/access.server";
import { ContentError, archived, checkLockVersion, forbidden, invalid, notFound } from "@/lib/content-model/errors";
import {
  isRecord,
  optionalEnum,
  optionalInt,
  rejectUnknown,
  requireEnum,
  requireIdempotencyKey,
  requireString,
  requireUuid,
  type JsonRecord,
} from "@/lib/content-model/input";
import { parseAssetPayload, parseFileType, parseResourceInputs } from "@/lib/content-model/payload";
import {
  audit,
  claimIdempotency,
  contentTransaction,
  grantLockKey,
  lockKeys,
  recordIdempotency,
  requestHash,
  type Trx,
} from "@/lib/content-model/tx.server";
import {
  insertPlacementTx,
  parsePlacementFields,
  resolveTargetForWrite,
  buildPlacementDtos,
  loadPlacementRows,
  type PlacementFields,
} from "@/lib/placements/core.server";
import { ASSET_FULL_COLUMNS, buildAssetDtos, loadAssetDto, loadAssetRows, loadVersionDtos } from "./dto.server";
import { computeImpact, hasDependencies, listGrants } from "./usage.server";
import { appendVersion } from "./versions.server";

const VISIBILITIES: readonly AssetVisibility[] = ["restricted", "organization"];
const ORIGINS: readonly AssetOrigin[] = ["team_upload", "public_submission", "legacy"];

// ───────────────────────── catalogs ─────────────────────────

export function parseAssetListQuery(params: URLSearchParams): AssetListQuery {
  const get = (name: string) => params.get(name) ?? undefined;
  const limit = get("limit");
  const offset = get("offset");
  const state = get("state");
  return {
    view: optionalEnum(get("view"), "view", ["shared", "maintained", "all"] as const),
    q: get("q")?.slice(0, 100) || undefined,
    file_type: optionalEnum(get("file_type"), "file_type", ASSET_FILE_TYPES),
    origin: optionalEnum(get("origin"), "origin", ORIGINS),
    state: state === undefined ? undefined : requireEnum(state, "state", ["active", "archived", "all"] as const),
    usable_in: get("usable_in") ? requireUuid(get("usable_in"), "usable_in") : undefined,
    limit: limit === undefined ? undefined : optionalInt(Number(limit), "limit", 1, 200),
    offset: offset === undefined ? undefined : optionalInt(Number(offset), "offset", 0, 1_000_000),
  };
}

type CatalogScope =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "organization"; organizationId: string; view: "shared" | "maintained" | "all"; actorId: string };

async function queryCatalog(actor: Actor, scope: CatalogScope, query: AssetListQuery, usableIn?: WorkspaceAccess): Promise<ApiPage<AssetDto>> {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  let base = db.selectFrom("asset").where("asset.organization_id", "is not", null).where("asset.current_version_id", "is not", null);
  if (scope.kind === "workspace") {
    base = base.where((eb) =>
      eb.exists(
        eb.selectFrom("asset_workspace_grant as g").select("g.asset_id").whereRef("g.asset_id", "=", "asset.id").where("g.workspace_id", "=", scope.workspaceId),
      ),
    );
  } else {
    base = base.where("asset.organization_id", "=", scope.organizationId);
    if (scope.view === "shared") base = base.where("asset.visibility", "=", "organization");
    if (scope.view === "maintained") base = base.where("asset.maintained_by", "=", scope.actorId);
  }
  if (query.file_type) base = base.where("asset.file_type", "=", query.file_type);
  else base = base.where("asset.file_type", "not in", [...SPECIAL_ASSET_FILE_TYPES]);
  if (query.origin) base = base.where("asset.origin", "=", query.origin);
  const state = query.state ?? "active";
  if (state !== "all") base = base.where("asset.state", "=", state);
  if (query.q) base = base.where("asset.name", "ilike", `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const [{ total }, rows] = await Promise.all([
    base.select(({ fn }) => fn.countAll<number>().as("total")).executeTakeFirstOrThrow(),
    base.select(ASSET_FULL_COLUMNS).orderBy("asset.updated_at", "desc").orderBy("asset.id").limit(limit).offset(offset).execute(),
  ]);
  const typed = rows.flatMap((row) => (row.organization_id ? [{ ...row, organization_id: row.organization_id }] : []));
  const data = await buildAssetDtos(db, actor, typed, { usableIn });
  return { data, page: { limit, offset, total: Number(total) } };
}

/** Project assets: everything granted to the project (plan §4.1 "项目素材"). */
export async function listWorkspaceAssets(actor: Actor, workspaceId: string, query: AssetListQuery): Promise<ApiPage<AssetDto>> {
  const access = await requireWorkspaceRead(db, actor, workspaceId);
  return queryCatalog(actor, { kind: "workspace", workspaceId }, query, access);
}

/** Organization catalog: shared (default), maintained by me, or all (owner/admin). */
export async function listOrganizationAssets(actor: Actor, organizationId: string, query: AssetListQuery): Promise<ApiPage<AssetDto>> {
  const org = await requireOrgRead(db, actor, organizationId);
  const view = query.view ?? "shared";
  if (view === "all" && !org.canAdminister) throw forbidden("只有组织管理员可以查看全部素材");
  let usableIn: WorkspaceAccess | undefined;
  if (query.usable_in) {
    usableIn = (await loadWorkspaceAccess(db, actor, query.usable_in)) ?? undefined;
    if (!usableIn?.canRead || usableIn.workspace.organization_id !== organizationId) throw notFound("项目不存在");
  }
  return queryCatalog(actor, { kind: "organization", organizationId, view, actorId: actor.userId }, query, usableIn);
}

export async function getAssetDetail(actor: Actor, assetId: string): Promise<AssetDetailDto> {
  const access = await requireAssetRead(db, actor, assetId);
  const asset = await loadAssetDto(db, actor, assetId);
  if (!asset) throw notFound("素材不存在");
  const versionRows = await db.selectFrom("asset_version").select("id").where("asset_id", "=", assetId).orderBy("version_no", "desc").execute();
  const versions = await loadVersionDtos(db, versionRows.map((v) => v.id));
  const grants = access.canMaintain || access.canAdminister ? await listGrants(db, actor, assetId) : (await listGrants(db, actor, assetId)).filter((g) => g.workspace_name !== null);
  return { ...asset, versions: versionRows.flatMap((v) => (versions.has(v.id) ? [versions.get(v.id)!] : [])), grants };
}

// ───────────────────────── create ─────────────────────────

export interface ParsedCreateAsset {
  name: string;
  fileType: ReturnType<typeof parseFileType>;
  payload: ReturnType<typeof parseAssetPayload>;
  resources: ReturnType<typeof parseResourceInputs>;
  visibility: AssetVisibility;
  idempotencyKey?: string;
  placement?: PlacementFields;
}

export function parseCreateAsset(body: JsonRecord, opts: { requireKey: boolean; allowPlacement: boolean }): ParsedCreateAsset {
  rejectUnknown(body, ["name", "fileType", "payload", "resources", "visibility", ...(opts.requireKey ? ["idempotencyKey"] : []), ...(opts.allowPlacement ? ["placement"] : [])]);
  const fileType = parseFileType(body.fileType);
  if (fileType === "anchor") throw invalid("匹配点使用专用接口维护，不能作为普通素材创建");
  const placement = body.placement === undefined ? undefined : parsePlacementFields(isRecord(body.placement) ? body.placement : (() => { throw invalid("placement 必须是对象"); })());
  return {
    name: requireString(body.name, "name", { max: 200 }),
    fileType,
    payload: parseAssetPayload(fileType, body.payload),
    resources: parseResourceInputs(fileType, body.resources),
    visibility: body.visibility === undefined ? "restricted" : requireEnum(body.visibility, "visibility", VISIBILITIES),
    idempotencyKey: opts.requireKey ? requireIdempotencyKey(body.idempotencyKey) : undefined,
    placement,
  };
}

/** Asset identity + v1 + origin grant (+ optional placement) inside an open transaction. */
export async function createAssetTx(
  trx: Trx,
  actor: Actor,
  workspace: WorkspaceAccess,
  input: ParsedCreateAsset,
  opts: { origin?: AssetOrigin; maintainedBy?: string | null; createdBy?: string | null } = {},
): Promise<{ assetId: string; versionId: string; placementId: string | null }> {
  const createdBy = opts.createdBy === undefined ? actor.userId : opts.createdBy;
  const asset = await trx
    .insertInto("asset")
    .values({
      organization_id: workspace.workspace.organization_id,
      origin_workspace_id: workspace.workspace.id,
      maintained_by: opts.maintainedBy === undefined ? actor.userId : opts.maintainedBy,
      visibility: input.visibility,
      state: "active",
      origin: opts.origin ?? "team_upload",
      file_type: input.fileType,
      name: input.name,
      created_by: createdBy,
    })
    .returning(["id", "organization_id"])
    .executeTakeFirstOrThrow();
  const organizationId = workspace.workspace.organization_id;
  await lockKeys(trx, [grantLockKey(asset.id, workspace.workspace.id)]);
  await trx
    .insertInto("asset_workspace_grant")
    .values({ asset_id: asset.id, workspace_id: workspace.workspace.id, organization_id: organizationId, created_by: createdBy })
    .execute();
  const { versionId } = await appendVersion(trx, actor, { id: asset.id, organization_id: organizationId }, input.payload, input.resources, {
    actorIdForRow: createdBy,
    useIn: workspace,
  });
  let placementId: string | null = null;
  if (input.placement) {
    const resolved = await resolveTargetForWrite(trx, actor, workspace, { kind: "asset_version", assetVersionId: versionId });
    placementId = await insertPlacementTx(trx, actor, workspace, resolved, { ...input.placement, name: input.placement.name ?? input.name });
  }
  await audit(trx, {
    organizationId,
    actorId: actor.userId,
    action: "asset.create",
    objectType: "asset",
    objectId: asset.id,
    workspaceId: workspace.workspace.id,
    details: { version_id: versionId, placement_id: placementId, origin: opts.origin ?? "team_upload" },
  });
  return { assetId: asset.id, versionId, placementId };
}

async function createResult(actor: Actor, assetId: string, versionId: string, placementId: string | null, created: boolean): Promise<CreateAssetResult> {
  const [asset, versions, placementRows] = await Promise.all([
    loadAssetDto(db, actor, assetId),
    loadVersionDtos(db, [versionId]),
    placementId ? loadPlacementRows(db, [placementId]) : Promise.resolve([]),
  ]);
  if (!asset) throw notFound("素材不存在");
  const placement: PlacementDto | null = placementRows.length ? (await buildPlacementDtos(db, actor, placementRows))[0] : null;
  return { asset, version: versions.get(versionId)!, placement, created };
}

/** POST /api/workspaces/[id]/assets (v2). Replays with the same key return the first result. */
export async function createAssetInWorkspace(actor: Actor, workspaceId: string, body: JsonRecord): Promise<CreateAssetResult> {
  const input = parseCreateAsset(body, { requireKey: true, allowPlacement: true });
  const workspace = await requireWorkspaceEdit(db, actor, workspaceId);
  const scope = { actorId: actor.userId, command: "asset.create", key: input.idempotencyKey!, hash: requestHash({ workspaceId, ...body }) };
  const outcome = await contentTransaction(async (trx) => {
    await lockWorkspaceForWrite(trx, workspace);
    const previous = await claimIdempotency(trx, scope);
    if (previous) {
      const asset = await trx.selectFrom("asset").select(["id", "current_version_id"]).where("id", "=", previous).executeTakeFirstOrThrow();
      const firstVersion = await trx.selectFrom("asset_version").select("id").where("asset_id", "=", previous).where("version_no", "=", 1).executeTakeFirst();
      const placement = await trx.selectFrom("placement").select("id").where("asset_id", "=", previous).orderBy("created_at").limit(1).executeTakeFirst();
      return { assetId: asset.id, versionId: firstVersion?.id ?? asset.current_version_id!, placementId: input.placement ? placement?.id ?? null : null, created: false };
    }
    const created = await createAssetTx(trx, actor, workspace, input);
    await recordIdempotency(trx, scope, workspace.workspace.organization_id, "asset", created.assetId);
    return { ...created, created: true };
  });
  return createResult(actor, outcome.assetId, outcome.versionId, outcome.placementId, outcome.created);
}

// ───────────────────────── versions ─────────────────────────

/** POST /api/assets/[id]/versions: immutable version from upload receipts / existing files. */
export async function createAssetVersion(actor: Actor, assetId: string, body: JsonRecord): Promise<CreateVersionResult> {
  rejectUnknown(body, ["payload", "resources", "idempotencyKey", "expectedLockVersion"]);
  const key = requireIdempotencyKey(body.idempotencyKey);
  const expected = optionalInt(body.expectedLockVersion, "expectedLockVersion", 0);
  const pre = await requireAssetMaintain(db, actor, assetId);
  const fileType = parseFileType(pre.asset.file_type);
  const payload = parseAssetPayload(fileType, body.payload);
  const resources = parseResourceInputs(fileType, body.resources);
  const scope = { actorId: actor.userId, command: "asset.version", key, hash: requestHash({ assetId, payload, resources }) };
  const outcome = await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, pre.asset.organization_id);
    const previous = await claimIdempotency(trx, scope);
    if (previous) return { versionId: previous, created: false };
    const access = await requireAssetMaintain(trx, actor, assetId, { forUpdate: true });
    if (expected !== undefined) checkLockVersion(expected, access.asset.lock_version, "素材");
    if (access.asset.state !== "active") throw archived("素材已归档，请先恢复再上传新版本");
    const { versionId, versionNo } = await appendVersion(trx, actor, access.asset, payload, resources);
    await recordIdempotency(trx, scope, access.asset.organization_id, "asset_version", versionId);
    await audit(trx, {
      organizationId: access.asset.organization_id,
      actorId: actor.userId,
      action: "asset.version.create",
      objectType: "asset_version",
      objectId: versionId,
      details: { asset_id: assetId, version_no: versionNo, previous_version_id: access.asset.current_version_id },
    });
    return { versionId, created: true };
  });
  const [asset, versions] = await Promise.all([loadAssetDto(db, actor, assetId), loadVersionDtos(db, [outcome.versionId])]);
  if (!asset) throw notFound("素材不存在");
  return { asset, version: versions.get(outcome.versionId)!, created: outcome.created };
}

// ───────────────────────── identity maintenance ─────────────────────────

/** PATCH /api/assets/[id] (v2): name / visibility / restore / maintainer, guarded by lock_version. */
export async function updateAssetIdentity(actor: Actor, assetId: string, body: JsonRecord): Promise<AssetDto> {
  rejectUnknown(body, ["expectedLockVersion", "name", "visibility", "state", "maintainedBy"]);
  const expected = body.expectedLockVersion === undefined ? undefined : optionalInt(body.expectedLockVersion, "expectedLockVersion", 0);
  const name = body.name === undefined ? undefined : requireString(body.name, "name", { max: 200 });
  const visibility = body.visibility === undefined ? undefined : requireEnum(body.visibility, "visibility", VISIBILITIES);
  const state = body.state === undefined ? undefined : requireEnum(body.state, "state", ["active"] as const);
  const maintainedBy = body.maintainedBy === undefined ? undefined : body.maintainedBy === null ? null : requireUuid(body.maintainedBy, "maintainedBy");
  const pre = await requireAssetMaintain(db, actor, assetId);
  await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, pre.asset.organization_id);
    const access = await requireAssetMaintain(trx, actor, assetId, { forUpdate: true });
    checkLockVersion(expected, access.asset.lock_version, "素材");
    const restoring = state === "active" && access.asset.state === "archived";
    if (access.asset.state === "archived" && !restoring) throw archived("素材已归档，请先恢复");
    const changes: Record<string, unknown> = {};
    if (name !== undefined && name !== access.asset.name) changes.name = name;
    if (visibility !== undefined && visibility !== access.asset.visibility) changes.visibility = visibility;
    if (maintainedBy !== undefined && maintainedBy !== access.asset.maintained_by) {
      if (!access.canTransfer) throw forbidden("只有组织管理员可以转交素材维护者");
      if (maintainedBy) {
        const member = await trx
          .selectFrom("organization_member")
          .select("role")
          .where("organization_id", "=", access.asset.organization_id)
          .where("user_id", "=", maintainedBy)
          .executeTakeFirst();
        if (!member || member.role === "viewer") throw invalid("新维护者必须是可写的组织成员");
      }
      changes.maintained_by = maintainedBy;
    }
    if (restoring) Object.assign(changes, { state: "active", archived_at: null, archived_by: null });
    if (!Object.keys(changes).length) return;
    await trx
      .updateTable("asset")
      .set((eb) => ({ ...changes, lock_version: eb("lock_version", "+", 1) }))
      .where("id", "=", assetId)
      .execute();
    const action = restoring ? "asset.restore" : "maintained_by" in changes ? "asset.maintainer.transfer" : "visibility" in changes ? "asset.visibility.change" : "asset.update";
    await audit(trx, {
      organizationId: access.asset.organization_id,
      actorId: actor.userId,
      action,
      objectType: "asset",
      objectId: assetId,
      details: {
        changes,
        before: { name: access.asset.name, visibility: access.asset.visibility, maintained_by: access.asset.maintained_by, state: access.asset.state },
      },
    });
  });
  const dto = await loadAssetDto(db, actor, assetId);
  if (!dto) throw notFound("素材不存在");
  return dto;
}

/** DELETE /api/assets/[id] (v2) = archive; existing references keep working (plan §5.2). */
export async function archiveAsset(actor: Actor, assetId: string, expectedLockVersion: number | undefined): Promise<ArchiveAssetResult> {
  const pre = await requireAssetMaintain(db, actor, assetId);
  await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, pre.asset.organization_id);
    const access = await requireAssetMaintain(trx, actor, assetId, { forUpdate: true });
    checkLockVersion(expectedLockVersion, access.asset.lock_version, "素材");
    if (access.asset.state === "archived") return;
    await trx
      .updateTable("asset")
      .set((eb) => ({ state: "archived", archived_at: sql<Date>`now()`, archived_by: actor.userId, lock_version: eb("lock_version", "+", 1) }))
      .where("id", "=", assetId)
      .execute();
    await audit(trx, { organizationId: access.asset.organization_id, actorId: actor.userId, action: "asset.archive", objectType: "asset", objectId: assetId });
  });
  const [asset, impact] = await Promise.all([loadAssetDto(db, actor, assetId), computeImpact(db, actor, assetId)]);
  if (!asset) throw notFound("素材不存在");
  return { asset, impact };
}

/** POST /api/assets/[id]/duplicate: new identity + v1 sharing the physical files. */
export async function duplicateAsset(actor: Actor, assetId: string, body: JsonRecord): Promise<CreateAssetResult> {
  rejectUnknown(body, ["targetWorkspaceId", "name", "sourceVersionId", "idempotencyKey"]);
  const targetId = requireUuid(body.targetWorkspaceId, "targetWorkspaceId");
  const key = requireIdempotencyKey(body.idempotencyKey);
  const source = await requireAssetRead(db, actor, assetId);
  const sourceVersionId = body.sourceVersionId === undefined ? source.asset.current_version_id : requireUuid(body.sourceVersionId, "sourceVersionId");
  if (!sourceVersionId) throw invalid("素材没有可复制的版本");
  const target = await requireWorkspaceEdit(db, actor, targetId);
  if (target.workspace.organization_id !== source.asset.organization_id) throw invalid("只能在同一组织内另存副本");
  const name = body.name === undefined ? `${source.asset.name ?? "素材"} 副本` : requireString(body.name, "name", { max: 200 });
  const scope = { actorId: actor.userId, command: "asset.duplicate", key, hash: requestHash({ assetId, targetId, name, sourceVersionId }) };
  const outcome = await contentTransaction(async (trx) => {
    await lockWorkspaceForWrite(trx, target);
    const previous = await claimIdempotency(trx, scope);
    if (previous) {
      const v1 = await trx.selectFrom("asset_version").select("id").where("asset_id", "=", previous).where("version_no", "=", 1).executeTakeFirstOrThrow();
      return { assetId: previous, versionId: v1.id, created: false };
    }
    await ensureAssetUse(trx, actor, assetId, target);
    const version = await trx
      .selectFrom("asset_version")
      .select(["id", "payload"])
      .where("id", "=", sourceVersionId)
      .where("asset_id", "=", assetId)
      .executeTakeFirst();
    if (!version) throw notFound("来源版本不存在");
    const resources = await trx.selectFrom("asset_version_resource").select(["role", "ordinal"]).where("asset_version_id", "=", version.id).execute();
    const fileType = parseFileType(source.asset.file_type);
    const created = await createAssetTx(trx, actor, target, {
      name,
      fileType,
      // Stored payloads are immutable and were validated (or migrated) on write; copy verbatim.
      payload: version.payload as unknown as ParsedCreateAsset["payload"],
      resources: resources.map((r) => ({
        role: r.role as ResourceRole,
        ordinal: r.ordinal,
        fromVersionId: version.id,
        fromRole: r.role as ResourceRole,
        fromOrdinal: r.ordinal,
      })),
      visibility: "restricted",
    });
    await recordIdempotency(trx, scope, target.workspace.organization_id, "asset", created.assetId);
    await audit(trx, {
      organizationId: target.workspace.organization_id,
      actorId: actor.userId,
      action: "asset.duplicate",
      objectType: "asset",
      objectId: created.assetId,
      workspaceId: target.workspace.id,
      details: { source_asset_id: assetId, source_version_id: version.id },
    });
    return { assetId: created.assetId, versionId: created.versionId, created: true };
  });
  return createResult(actor, outcome.assetId, outcome.versionId, null, outcome.created);
}

// ───────────────────────── usage & grants ─────────────────────────

export async function getAssetUsage(actor: Actor, assetId: string): Promise<AssetUsageDto> {
  const access = await requireAssetRead(db, actor, assetId);
  const [impact, grants] = await Promise.all([computeImpact(db, actor, assetId), listGrants(db, actor, assetId)]);
  return {
    asset_id: assetId,
    current_version_id: access.asset.current_version_id,
    impact,
    grants: grants.filter((g) => g.workspace_name !== null || access.canMaintain),
  };
}

/** POST /api/assets/[id]/workspace-grants: maintainer shares the asset with a same-org project. */
export async function createAssetGrant(actor: Actor, assetId: string, body: JsonRecord): Promise<AssetGrantDto> {
  rejectUnknown(body, ["workspaceId"]);
  const workspaceId = requireUuid(body.workspaceId, "workspaceId");
  const pre = await requireAssetMaintain(db, actor, assetId);
  const target = await requireWorkspaceRead(db, actor, workspaceId);
  if (target.workspace.organization_id !== pre.asset.organization_id) throw invalid("只能授权给同一组织的项目");
  await contentTransaction(async (trx) => {
    await lockWorkspaceForWrite(trx, target);
    await lockKeys(trx, [grantLockKey(assetId, workspaceId)]);
    const access = await requireAssetMaintain(trx, actor, assetId, { forUpdate: true });
    if (access.asset.state !== "active") throw archived("素材已归档，不能新增授权");
    const inserted = await trx
      .insertInto("asset_workspace_grant")
      .values({ asset_id: assetId, workspace_id: workspaceId, organization_id: access.asset.organization_id, created_by: actor.userId })
      .onConflict((oc) => oc.columns(["asset_id", "workspace_id"]).doNothing())
      .returning("asset_id")
      .executeTakeFirst();
    if (inserted)
      await audit(trx, { organizationId: access.asset.organization_id, actorId: actor.userId, action: "asset.grant.create", objectType: "asset_grant", objectId: assetId, workspaceId });
  });
  const grant = (await listGrants(db, actor, assetId)).find((g) => g.workspace_id === workspaceId);
  if (!grant) throw new ContentError("INTERNAL", "授权未生效");
  return grant;
}

/**
 * DELETE /api/assets/[id]/workspace-grants?workspace_id=…  ("从项目移除").
 * The dependency scan runs under the same grant lock new references take,
 * so a concurrent save cannot slip a reference past the check.
 */
export async function revokeAssetGrant(actor: Actor, assetId: string, workspaceId: string): Promise<{ revoked: true }> {
  const pre = await requireAssetRead(db, actor, assetId);
  const project = await loadWorkspaceAccess(db, actor, workspaceId);
  if (!pre.canMaintain && !project?.canManage) throw forbidden("需要素材维护权或该项目的管理权限");
  await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, pre.asset.organization_id);
    await lockKeys(trx, [grantLockKey(assetId, workspaceId)]);
    const grant = await trx
      .selectFrom("asset_workspace_grant")
      .select("asset_id")
      .where("asset_id", "=", assetId)
      .where("workspace_id", "=", workspaceId)
      .forUpdate()
      .executeTakeFirst();
    if (!grant) throw notFound("该项目没有此素材的授权");
    const impact = await computeImpact(trx, actor, assetId, workspaceId);
    if (hasDependencies(impact))
      throw new ContentError("DEPENDENCY_CONFLICT", "该项目仍有草稿、发布版本或投放使用此素材，不能撤销授权", { impact });
    await trx.deleteFrom("asset_workspace_grant").where("asset_id", "=", assetId).where("workspace_id", "=", workspaceId).execute();
    await audit(trx, { organizationId: pre.asset.organization_id, actorId: actor.userId, action: "asset.grant.revoke", objectType: "asset_grant", objectId: assetId, workspaceId });
  });
  return { revoked: true };
}

/** For legacy-path readers: is this id a v2 identity row? */
export async function isV2Asset(assetId: string): Promise<boolean> {
  const rows = await loadAssetRows(db, [assetId]);
  return rows.length > 0;
}

/** Ids of projects the caller can read in an organization (null = all). */
export { readableWorkspaceIds };
