import { asFileType } from "@/lib/assets/dto.server";
import {
  ensureAssetUse,
  loadWorkspaceAccessMany,
  type Actor,
  type WorkspaceAccess,
} from "@/lib/content-model/access.server";
import type {
  AssetFileType,
  GeoPointInput,
  PlacementDto,
  PlacementRenderConfig,
  PlacementStatus,
  PlacementTargetDto,
  PlacementTargetInput,
  SceneState,
} from "@/lib/content-model/contracts";
import { ContentError, archived, invalid, notFound } from "@/lib/content-model/errors";
import { isRecord, isUuid, optionalString, requireNumber, requireUuid } from "@/lib/content-model/input";
import { parseRenderConfig } from "@/lib/content-model/payload";
import { toIsoRequired, type Executor, type Trx } from "@/lib/content-model/tx.server";
import { sql } from "@/lib/db";
import "server-only";

export const PLACEMENT_STATUSES: readonly PlacementStatus[] = ["draft", "active", "paused", "archived"];

export const asPlacementStatus = (value: string): PlacementStatus =>
  value === "active" || value === "paused" || value === "archived" ? value : "draft";

// ───────────────────────── input parsing ─────────────────────────

export function parseGeoPoint(value: unknown, field = "location"): GeoPointInput | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalid(`${field} 必须是对象或 null`);
  const altitude = value.altitude === undefined || value.altitude === null ? null : requireNumber(value.altitude, `${field}.altitude`, -1e5, 1e5);
  return {
    longitude: requireNumber(value.longitude, `${field}.longitude`, -180, 180),
    latitude: requireNumber(value.latitude, `${field}.latitude`, -90, 90),
    altitude,
  };
}

export function parseTarget(value: unknown): PlacementTargetInput {
  if (!isRecord(value)) throw invalid("target 必须是对象");
  if (value.kind === "asset_version") return { kind: "asset_version", assetVersionId: requireUuid(value.assetVersionId, "target.assetVersionId") };
  if (value.kind === "scene_revision") return { kind: "scene_revision", sceneRevisionId: requireUuid(value.sceneRevisionId, "target.sceneRevisionId") };
  throw invalid("target.kind 必须是 asset_version 或 scene_revision");
}

export function parseTagIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 50) throw invalid("tagIds 必须是不超过 50 项的数组");
  return [...new Set(value.map((id) => requireUuid(id, "tagIds")))];
}

export function parseStatus(value: unknown): PlacementStatus | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(PLACEMENT_STATUSES as readonly string[]).includes(value)) throw invalid("status 无效");
  return value as PlacementStatus;
}

export const parsePlacementName = (value: unknown) => optionalString(value, "name", { max: 200 });

export function pointSql(point: GeoPointInput) {
  return sql<string>`ST_SetSRID(ST_MakePoint(${point.longitude}::float8, ${point.latitude}::float8), 4326)`;
}

// ───────────────────────── target resolution ─────────────────────────

export interface ResolvedTarget {
  kind: "asset_version" | "scene_revision";
  assetId: string | null;
  assetVersionId: string | null;
  sceneRevisionId: string | null;
  fileType: AssetFileType | "scene";
  sceneId: string | null;
  /** The scene's legacy origin collection, if any. */
  sceneWorkspaceId: string | null;
  instanceCount: number;
}

/**
 * Check a placement target inside the write transaction (plan §4.4, team
 * workbench contract). The caller is a team writer of the target collection
 * (`target.canEdit`); any same-team content may be placed there:
 * - asset versions: same org, asset active (share lock) unless the exact
 *   version is already this placement's target;
 * - scene revisions: same org, scene not archived unless unchanged. A scene
 *   is never copied to be placed into another collection.
 */
export async function resolveTargetForWrite(
  trx: Trx,
  actor: Actor,
  target: WorkspaceAccess,
  input: PlacementTargetInput,
  opts: { currentTarget?: { assetVersionId: string | null; sceneRevisionId: string | null } } = {},
): Promise<ResolvedTarget> {
  if (input.kind === "asset_version") {
    const version = await trx
      .selectFrom("asset_version as v")
      .innerJoin("asset as a", "a.id", "v.asset_id")
      .select(["v.id", "v.asset_id", "v.organization_id", "a.file_type"])
      .where("v.id", "=", input.assetVersionId)
      .executeTakeFirst();
    if (!version || version.organization_id !== target.workspace.organization_id) throw notFound("素材版本不存在");
    const unchanged = opts.currentTarget?.assetVersionId === version.id;
    await ensureAssetUse(trx, actor, version.asset_id, target, { existingReference: unchanged });
    return {
      kind: "asset_version",
      assetId: version.asset_id,
      assetVersionId: version.id,
      sceneRevisionId: null,
      fileType: asFileType(version.file_type),
      sceneId: null,
      sceneWorkspaceId: null,
      instanceCount: 1,
    };
  }
  const revision = await trx
    .selectFrom("scene_revision as r")
    .innerJoin("scene as s", "s.id", "r.scene_id")
    .select(["r.id", "r.organization_id", "r.document", "s.id as scene_id", "s.workspace_id", "s.state"])
    .where("r.id", "=", input.sceneRevisionId)
    .executeTakeFirst();
  if (!revision || revision.organization_id !== target.workspace.organization_id) throw notFound("场景发布版本不存在");
  const unchanged = opts.currentTarget?.sceneRevisionId === revision.id;
  if (!unchanged) {
    if (!target.canEdit) throw new ContentError("FORBIDDEN", "组织查看者只能浏览团队内容");
    if (revision.state === "archived") throw archived("场景已归档，不能新建或切换投放");
  }
  const content = isRecord(revision.document) && isRecord(revision.document.content) ? revision.document.content : null;
  const instanceCount = Array.isArray(content?.instances) ? content.instances.length : 0;
  return {
    kind: "scene_revision",
    assetId: null,
    assetVersionId: null,
    sceneRevisionId: revision.id,
    fileType: "scene",
    sceneId: revision.scene_id,
    sceneWorkspaceId: revision.workspace_id,
    instanceCount,
  };
}

/** Active placements need a discovery path the runtime supports (GPS or anchor); shops may be directory-only. */
export function assertDiscoverable(status: PlacementStatus, location: GeoPointInput | null, anchorId: string | null, target: ResolvedTarget): void {
  if (status !== "active") return;
  if (target.kind === "scene_revision" && target.instanceCount === 0) throw invalid("空场景不能创建有效投放，请先添加对象并发布");
  if (!location && !anchorId && target.fileType !== "shop") throw invalid("有效投放必须设置 GPS 位置或识别目标");
}

/** A recognition target must have an active placement in this collection. */
export async function assertAnchorUsable(trx: Executor, anchorId: string, target: WorkspaceAccess): Promise<void> {
  const anchor = await trx.selectFrom("asset as a")
    .innerJoin("placement as p", "p.asset_id", "a.id")
    .select("a.id").where("a.id", "=", anchorId).where("a.file_type", "=", "anchor")
    .where("a.organization_id", "=", target.workspace.organization_id)
    .where("p.workspace_id", "=", target.workspace.id).where("p.status", "=", "active")
    .executeTakeFirst();
  if (!anchor) throw invalid("识别目标必须是本合集已投放的匹配点");
}

export async function replaceTags(trx: Trx, placementId: string, workspaceId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length) {
    const tags = await trx.selectFrom("tag").select("id").where("id", "in", tagIds).where("workspace_id", "=", workspaceId).execute();
    if (tags.length !== tagIds.length) throw invalid("标签必须属于投放所在合集");
  }
  await trx.deleteFrom("placement_tag").where("placement_id", "=", placementId).execute();
  if (tagIds.length)
    await trx.insertInto("placement_tag").values(tagIds.map((tag_id) => ({ placement_id: placementId, tag_id, workspace_id: workspaceId }))).execute();
}

export interface PlacementFields {
  name?: string | null;
  location?: GeoPointInput | null;
  anchorId?: string | null;
  renderConfig?: unknown;
  /** Already-stored render config copied verbatim (e.g. migrated nested values); not re-parsed. */
  storedRenderConfig?: PlacementRenderConfig;
  status?: PlacementStatus;
  tagIds?: string[];
}

export function parsePlacementFields(body: Record<string, unknown>): PlacementFields {
  return {
    name: parsePlacementName(body.name),
    location: body.location === undefined ? undefined : parseGeoPoint(body.location),
    anchorId: body.anchorId === undefined ? undefined : body.anchorId === null ? null : requireUuid(body.anchorId, "anchorId"),
    renderConfig: body.renderConfig,
    status: parseStatus(body.status),
    tagIds: parseTagIds(body.tagIds),
  };
}

/** Insert one placement owned by `target` (caller holds the write locks). */
export async function insertPlacementTx(
  trx: Trx,
  actor: Actor,
  target: WorkspaceAccess,
  resolved: ResolvedTarget,
  fields: PlacementFields,
): Promise<string> {
  const status = fields.status ?? "active";
  const location = fields.location ?? null;
  const anchorId = fields.anchorId ?? null;
  const renderConfig: PlacementRenderConfig = fields.storedRenderConfig ?? parseRenderConfig(fields.renderConfig, resolved.fileType);
  assertDiscoverable(status, location, anchorId, resolved);
  if (anchorId) await assertAnchorUsable(trx, anchorId, target);
  const row = await trx
    .insertInto("placement")
    .values({
      organization_id: target.workspace.organization_id,
      workspace_id: target.workspace.id,
      name: fields.name ?? null,
      asset_id: resolved.assetId,
      asset_version_id: resolved.assetVersionId,
      scene_revision_id: resolved.sceneRevisionId,
      location: location ? pointSql(location) : null,
      altitude: location?.altitude ?? null,
      anchor_id: anchorId,
      render_config: JSON.stringify(renderConfig),
      status,
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (fields.tagIds?.length) await replaceTags(trx, row.id, target.workspace.id, fields.tagIds);
  return row.id;
}

// ───────────────────────── DTOs ─────────────────────────

export const PLACEMENT_COLUMNS = [
  "p.id",
  "p.organization_id",
  "p.workspace_id",
  "p.name",
  "p.asset_id",
  "p.asset_version_id",
  "p.scene_revision_id",
  "p.altitude",
  "p.anchor_id",
  "p.render_config",
  "p.status",
  "p.lock_version",
  "p.created_by",
  "p.updated_by",
  "p.created_at",
  "p.updated_at",
] as const;

export interface PlacementRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  name: string | null;
  asset_id: string | null;
  asset_version_id: string | null;
  scene_revision_id: string | null;
  altitude: number | null;
  anchor_id: string | null;
  render_config: unknown;
  status: string;
  lock_version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  longitude: number | null;
  latitude: number | null;
}

export function placementQuery(exec: Executor) {
  return exec
    .selectFrom("placement as p")
    .select(PLACEMENT_COLUMNS)
    .select([sql<number | null>`ST_X(p.location)`.as("longitude"), sql<number | null>`ST_Y(p.location)`.as("latitude")]);
}

export async function loadPlacementRows(exec: Executor, ids: string[]): Promise<PlacementRow[]> {
  if (!ids.length) return [];
  const rows = await placementQuery(exec).where("p.id", "in", ids).execute();
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id): PlacementRow[] => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export function renderConfigOf(value: unknown): PlacementRenderConfig {
  return isRecord(value) ? (value as PlacementRenderConfig) : {};
}

/** Pinned targets, collection tags and team-derived capabilities. */
export async function buildPlacementDtos(
  exec: Executor,
  actor: Actor,
  rows: PlacementRow[],
): Promise<PlacementDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const versionIds = rows.map((r) => r.asset_version_id).filter((id): id is string => !!id);
  const revisionIds = rows.map((r) => r.scene_revision_id).filter((id): id is string => !!id);
  const [versions, revisions, tags] = await Promise.all([
    versionIds.length
      ? exec
          .selectFrom("asset_version as v")
          .innerJoin("asset as a", "a.id", "v.asset_id")
          .select(["v.id", "v.asset_id", "v.version_no", "a.name", "a.file_type", "a.state", "a.current_version_id"])
          .where("v.id", "in", versionIds)
          .execute()
      : Promise.resolve([]),
    revisionIds.length
      ? exec
          .selectFrom("scene_revision as r")
          .innerJoin("scene as s", "s.id", "r.scene_id")
          .select([
            "r.id",
            "r.revision_no",
            "s.id as scene_id",
            "s.name as scene_name",
            "s.workspace_id as scene_workspace_id",
            "s.state as scene_state",
            (eb) =>
              eb
                .selectFrom("scene_revision as latest")
                .select("latest.id")
                .whereRef("latest.scene_id", "=", "s.id")
                .orderBy("latest.revision_no", "desc")
                .limit(1)
                .as("latest_revision_id"),
          ])
          .where("r.id", "in", revisionIds)
          .execute()
      : Promise.resolve([]),
    exec.selectFrom("placement_tag").select(["placement_id", "tag_id"]).where("placement_id", "in", ids).execute(),
  ]);
  const workspaceIds = [...new Set(rows.map((r) => r.workspace_id))];
  const access = await loadWorkspaceAccessMany(exec, actor, workspaceIds);
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const revisionById = new Map(revisions.map((r) => [r.id, r]));

  return rows.map((row): PlacementDto => {
    let target: PlacementTargetDto;
    if (row.asset_version_id) {
      const v = versionById.get(row.asset_version_id);
      target = {
        kind: "asset_version",
        asset_id: row.asset_id ?? v?.asset_id ?? "",
        asset_version_id: row.asset_version_id,
        version_no: v?.version_no ?? 0,
        asset_name: v?.name ?? null,
        file_type: asFileType(v?.file_type ?? "document"),
        asset_state: v?.state === "archived" ? "archived" : "active",
        current_version_id: v?.current_version_id ?? null,
        upgrade_available: !!v?.current_version_id && v.current_version_id !== row.asset_version_id,
      };
    } else {
      const r = revisionById.get(row.scene_revision_id ?? "");
      target = {
        kind: "scene_revision",
        scene_id: r?.scene_id ?? "",
        scene_revision_id: row.scene_revision_id ?? "",
        revision_no: r?.revision_no ?? 0,
        scene_name: r?.scene_name ?? "",
        scene_workspace_id: r?.scene_workspace_id ?? null,
        scene_state: (r?.scene_state === "archived" ? "archived" : "active") as SceneState,
        latest_revision_id: r?.latest_revision_id ?? null,
        upgrade_available: !!r?.latest_revision_id && r.latest_revision_id !== row.scene_revision_id,
      };
    }
    const own = access.get(row.workspace_id);
    const isShop = target.kind === "asset_version" && target.file_type === "shop";
    return {
      id: row.id,
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      workspace_name: own?.canRead ? own?.workspace.name ?? null : null,
      name: row.name,
      target,
      location: row.longitude !== null && row.latitude !== null ? { longitude: row.longitude, latitude: row.latitude, altitude: row.altitude } : null,
      anchor_id: row.anchor_id,
      render_config: renderConfigOf(row.render_config),
      status: asPlacementStatus(row.status),
      lock_version: row.lock_version,
      tag_ids: tags.filter((t) => t.placement_id === row.id).map((t) => t.tag_id),
      public_id: row.id,
      directory_only: isShop && row.longitude === null && !row.anchor_id,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: toIsoRequired(row.created_at),
      updated_at: toIsoRequired(row.updated_at),
      capabilities: {
        can_read: !!own?.canRead,
        can_edit: !!own?.canEdit,
        can_copy: !!own?.canEdit,
      },
    };
  });
}

/** Lock one placement row and its access for a mutation. */
export async function lockPlacement(trx: Trx, placementId: string): Promise<PlacementRow> {
  if (!isUuid(placementId)) throw notFound("投放不存在");
  const locked = await trx.selectFrom("placement").select("id").where("id", "=", placementId).forUpdate().executeTakeFirst();
  if (!locked) throw notFound("投放不存在");
  const [row] = await loadPlacementRows(trx, [placementId]);
  return row;
}

export function assertPlacementWritable(access: WorkspaceAccess | null): asserts access is WorkspaceAccess {
  if (!access?.canRead) throw notFound("投放不存在");
  if (!access.canEdit) {
    if (access.org.archived_at) throw archived("组织已归档，内容只读");
    if (access.workspace.archived_at) throw archived("合集已归档，投放只读");
    throw new ContentError("FORBIDDEN", "组织查看者只能浏览团队内容");
  }
}
