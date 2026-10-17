import { asFileType, loadVersionDtos, primaryResource } from "@/lib/assets/dto.server";
import {
  assertOrgWritable,
  ensureAssetUse,
  loadOrgAccess,
  loadWorkspaceAccess,
  lockOrgForWrite,
  lockWorkspaceForWrite,
  requireOrgRead,
  requireOrgWrite,
  requireWorkspaceEdit,
  type Actor,
  type OrgAccess
} from "@/lib/content-model/access.server";
import type {
  ModelAnimationInfo,
  PlacementDto,
  PublishSceneResult,
  SceneDetailDto,
  SceneDocumentV3Json,
  ScenePublishStatus,
  SceneResolvedResourceDto,
  SceneRevisionSummaryDto,
  SceneSummaryDto,
} from "@/lib/content-model/contracts";
import { ContentError, archived, checkLockVersion, invalid, notFound } from "@/lib/content-model/errors";
import {
  isRecord,
  isUuid,
  optionalIdempotencyKey,
  rejectUnknown,
  requireEnum,
  requireInt,
  requireString,
  requireUuid,
  type JsonRecord,
} from "@/lib/content-model/input";
import {
  audit,
  claimIdempotency,
  contentTransaction,
  recordIdempotency,
  requestHash,
  toIsoRequired,
  type Executor,
  type Trx,
} from "@/lib/content-model/tx.server";
import { db, sql } from "@/lib/db";
import { assertPlacementWritable, buildPlacementDtos, loadPlacementRows, lockPlacement } from "@/lib/placements/core.server";
import "server-only";
import { clipIssues } from "./compile";
import { createBlankSceneDocument, type SceneDocumentV3 } from "./protocol";
import { validateSceneDocumentV3 } from "./validate";

/**
 * Independent team scenes (plan §4.3, team workbench contract). A scene
 * belongs to its organization; `workspace_id` only records a legacy origin
 * collection. Every team member reads it, team writers edit and publish it.
 * The schema-3 draft is the only source of references; scene_asset_ref /
 * scene_revision_asset_ref are derived inside the same transaction and never
 * written by any other API. Publishing pins the referenced versions; it never
 * re-reads an asset's current version.
 */

interface SceneRow {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  name: string;
  draft_document: unknown;
  lock_version: number;
  state: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const SCENE_COLUMNS = ["id", "organization_id", "workspace_id", "name", "draft_document", "lock_version", "state", "created_by", "updated_by", "created_at", "updated_at"] as const;

export function parseDocument(value: unknown): SceneDocumentV3 {
  const result = validateSceneDocumentV3(value);
  if (!result.ok)
    throw invalid(
      "场景草稿校验失败",
      result.issues.filter((i) => i.severity === "error").slice(0, 20).map((i) => ({ path: i.path, message: i.message })),
    );
  return value as SceneDocumentV3;
}

async function loadSceneRow(exec: Executor, sceneId: string, forUpdate = false): Promise<SceneRow | null> {
  if (!isUuid(sceneId)) return null;
  let query = exec.selectFrom("scene").select(SCENE_COLUMNS).where("id", "=", sceneId);
  if (forUpdate) query = query.forUpdate();
  return (await query.executeTakeFirst()) ?? null;
}

/** Scene + team access; scenes of other organizations are indistinguishable from missing ones. */
async function requireSceneRead(exec: Executor, actor: Actor, sceneId: string): Promise<{ scene: SceneRow; access: OrgAccess }> {
  const scene = await loadSceneRow(exec, sceneId);
  if (!scene) throw notFound("场景不存在");
  const access = await loadOrgAccess(exec, actor, scene.organization_id);
  if (!access?.canRead) throw notFound("场景不存在");
  return { scene, access };
}

async function requireSceneWrite(exec: Executor, actor: Actor, sceneId: string): Promise<{ scene: SceneRow; access: OrgAccess }> {
  const found = await requireSceneRead(exec, actor, sceneId);
  assertOrgWritable(found.access);
  return found;
}

// ───────────────────────── derived references ─────────────────────────

interface VersionInfo {
  id: string;
  asset_id: string;
  organization_id: string;
  file_type: string;
  payload: unknown;
}

function animationsOf(payload: unknown): ModelAnimationInfo[] | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.animations)) return undefined;
  return payload.animations as ModelAnimationInfo[];
}

/**
 * Validate every alias (version belongs to the named asset, same org, model
 * with a file, clip still present) and rebuild the draft index. New versions
 * go through ensureAssetUse (team writer, asset active under a share lock);
 * versions already pinned by this draft stay usable even if their asset was
 * archived since.
 */
async function syncDraftRefs(trx: Trx, actor: Actor, scene: { id: string; organization_id: string }, writer: OrgAccess, document: SceneDocumentV3): Promise<void> {
  const existing = await trx.selectFrom("scene_asset_ref").select(["asset_version_id"]).where("scene_id", "=", scene.id).execute();
  const pinned = new Set(existing.map((r) => r.asset_version_id));
  const entries = Object.entries(document.content.assets);
  const versionIds = [...new Set(entries.map(([, ref]) => ref.assetVersionId.toLowerCase()))];
  const versions: VersionInfo[] = versionIds.length
    ? await trx
        .selectFrom("asset_version as v")
        .innerJoin("asset as a", "a.id", "v.asset_id")
        .select(["v.id", "v.asset_id", "v.organization_id", "a.file_type", "v.payload"])
        .where("v.id", "in", versionIds)
        .execute()
    : [];
  const byId = new Map(versions.map((v) => [v.id, v]));
  const primaries = versionIds.length
    ? new Set(
        (await trx.selectFrom("asset_version_resource").select("asset_version_id").where("asset_version_id", "in", versionIds).where("role", "=", "primary").execute()).map(
          (r) => r.asset_version_id,
        ),
      )
    : new Set<string>();
  // Existence and use rights first, with one uniform message, so validation
  // details never describe versions the caller may not use.
  const missing = entries
    .filter(([, ref]) => {
      const version = byId.get(ref.assetVersionId.toLowerCase());
      return !version || version.organization_id !== scene.organization_id || version.asset_id !== ref.assetId.toLowerCase();
    })
    .map(([alias]) => ({ path: `content.assets.${alias}`, message: "素材版本不存在或不属于 assetId 指定的素材" }));
  if (missing.length) throw invalid("场景引用校验失败", missing);

  // Per asset: any not-yet-pinned version is a new reference.
  const byAsset = new Map<string, { isNew: boolean }>();
  for (const [, ref] of entries) {
    const assetId = ref.assetId.toLowerCase();
    const isNew = !pinned.has(ref.assetVersionId.toLowerCase());
    byAsset.set(assetId, { isNew: (byAsset.get(assetId)?.isNew ?? false) || isNew });
  }
  for (const [assetId, { isNew }] of [...byAsset.entries()].sort(([a], [b]) => a.localeCompare(b)))
    await ensureAssetUse(trx, actor, assetId, writer, { existingReference: !isNew });

  const issues: { path: string; message: string }[] = [];
  const animations: Record<string, ModelAnimationInfo[] | undefined> = {};
  for (const [alias, ref] of entries) {
    const version = byId.get(ref.assetVersionId.toLowerCase())!;
    const path = `content.assets.${alias}`;
    if (version.file_type !== "model") issues.push({ path, message: "场景目前只支持模型素材" });
    else if (!primaries.has(version.id)) issues.push({ path, message: "素材版本缺少模型文件" });
    else animations[alias] = animationsOf(version.payload);
  }
  issues.push(...clipIssues(document, animations));
  if (issues.length) throw invalid("场景引用校验失败", issues);

  await trx.deleteFrom("scene_asset_ref").where("scene_id", "=", scene.id).execute();
  if (entries.length)
    await trx
      .insertInto("scene_asset_ref")
      .values(
        entries.map(([alias, ref]) => ({
          scene_id: scene.id,
          organization_id: scene.organization_id,
          resource_alias: alias,
          asset_id: ref.assetId.toLowerCase(),
          asset_version_id: ref.assetVersionId.toLowerCase(),
        })),
      )
      .execute();
}

// ───────────────────────── DTOs ─────────────────────────

/** Derived, never stored: a rename/restore alone does not make published content "modified". */
function publishStatus(scene: SceneRow, latest: { source_lock_version: number; document: unknown } | undefined): ScenePublishStatus {
  if (scene.state === "archived") return "archived";
  if (!latest) return "unpublished";
  if (latest.source_lock_version === scene.lock_version) return "published";
  // jsonb values come back with normalized key order, so serialization is comparable.
  return JSON.stringify(latest.document) === JSON.stringify(scene.draft_document) ? "published" : "modified";
}

async function orgAccessMap(exec: Executor, actor: Actor, orgIds: string[]): Promise<Map<string, OrgAccess>> {
  const out = new Map<string, OrgAccess>();
  for (const orgId of new Set(orgIds)) {
    const access = await loadOrgAccess(exec, actor, orgId);
    if (access) out.set(orgId, access);
  }
  return out;
}

async function buildSceneSummaries(exec: Executor, actor: Actor, scenes: SceneRow[]): Promise<SceneSummaryDto[]> {
  if (!scenes.length) return [];
  const ids = scenes.map((s) => s.id);
  const [latest, placementCounts, revisionPlacements, access] = await Promise.all([
    exec
      .selectFrom("scene_revision")
      .select(["id", "scene_id", "revision_no", "source_lock_version", "name", "created_by", "created_at", "document"])
      .distinctOn("scene_id")
      .where("scene_id", "in", ids)
      .orderBy("scene_id")
      .orderBy("revision_no", "desc")
      .execute(),
    exec
      .selectFrom("placement as p")
      .innerJoin("scene_revision as r", "r.id", "p.scene_revision_id")
      .select(["r.scene_id", ({ fn }) => fn.countAll<number>().as("n")])
      .where("r.scene_id", "in", ids)
      .where("p.status", "<>", "archived")
      .groupBy("r.scene_id")
      .execute(),
    exec
      .selectFrom("placement as p")
      .select(["p.scene_revision_id", ({ fn }) => fn.countAll<number>().as("n")])
      .where("p.scene_revision_id", "in", exec.selectFrom("scene_revision").select("id").where("scene_id", "in", ids))
      .where("p.status", "<>", "archived")
      .groupBy("p.scene_revision_id")
      .execute(),
    orgAccessMap(exec, actor, scenes.map((s) => s.organization_id)),
  ]);
  const latestByScene = new Map(latest.map((r) => [r.scene_id, r]));
  const countByScene = new Map(placementCounts.map((r) => [r.scene_id, Number(r.n)]));
  const countByRevision = new Map(revisionPlacements.map((r) => [r.scene_revision_id ?? "", Number(r.n)]));
  return scenes.map((scene) => {
    const rev = latestByScene.get(scene.id);
    const org = access.get(scene.organization_id);
    const writable = !!org?.canWrite && !org.org.archived_at;
    const editable = writable && scene.state === "active";
    return {
      id: scene.id,
      organization_id: scene.organization_id,
      workspace_id: scene.workspace_id,
      name: scene.name,
      state: scene.state === "archived" ? "archived" : "active",
      lock_version: scene.lock_version,
      publish_status: publishStatus(scene, rev),
      latest_revision: rev
        ? {
            id: rev.id,
            scene_id: rev.scene_id,
            revision_no: rev.revision_no,
            source_lock_version: rev.source_lock_version,
            name: rev.name,
            created_by: rev.created_by,
            created_at: toIsoRequired(rev.created_at),
            placement_count: countByRevision.get(rev.id) ?? 0,
          }
        : null,
      placement_count: countByScene.get(scene.id) ?? 0,
      created_by: scene.created_by,
      updated_by: scene.updated_by,
      created_at: toIsoRequired(scene.created_at),
      updated_at: toIsoRequired(scene.updated_at),
      capabilities: { can_read: !!org?.canRead, can_edit: editable, can_publish: editable, can_archive: writable },
    };
  });
}

/** Resources pinned by alias → version, resolved from the version's own files. */
export async function resolvePinnedResources(exec: Executor, refs: { resource_alias: string; asset_id: string; asset_version_id: string }[]): Promise<SceneResolvedResourceDto[]> {
  if (!refs.length) return [];
  const versions = await loadVersionDtos(exec, refs.map((r) => r.asset_version_id));
  const assets = await exec
    .selectFrom("asset as a")
    .leftJoin("asset_version as cv", "cv.id", "a.current_version_id")
    .select(["a.id", "a.name", "a.file_type", "a.state", "a.current_version_id", "cv.version_no as current_version_no"])
    .where("a.id", "in", [...new Set(refs.map((r) => r.asset_id))])
    .execute();
  const assetById = new Map(assets.map((a) => [a.id, a]));
  return refs.map((ref) => {
    const version = versions.get(ref.asset_version_id);
    const asset = assetById.get(ref.asset_id);
    const payload = version?.payload;
    return {
      resource_alias: ref.resource_alias,
      asset_id: ref.asset_id,
      asset_version_id: ref.asset_version_id,
      version_no: version?.version_no ?? 0,
      asset_name: asset?.name ?? null,
      file_type: asFileType(asset?.file_type ?? "model"),
      asset_state: asset?.state === "archived" ? "archived" : "active",
      url: primaryResource(version)?.url ?? null,
      animations: payload && payload.kind === "model" ? payload.animations ?? [] : [],
      current_version_id: asset?.current_version_id ?? null,
      current_version_no: asset?.current_version_no ?? null,
      upgrade_available: !!asset?.current_version_id && asset.current_version_id !== ref.asset_version_id,
    };
  });
}

async function buildSceneDetail(exec: Executor, actor: Actor, scene: SceneRow): Promise<SceneDetailDto> {
  const [summary] = await buildSceneSummaries(exec, actor, [scene]);
  const refs = await exec
    .selectFrom("scene_asset_ref")
    .select(["resource_alias", "asset_id", "asset_version_id"])
    .where("scene_id", "=", scene.id)
    .orderBy("resource_alias")
    .execute();
  return {
    ...summary,
    draft_document: scene.draft_document as SceneDocumentV3Json,
    referenced_resources: await resolvePinnedResources(exec, refs),
  };
}

// ───────────────────────── queries ─────────────────────────

export type SceneListState = "active" | "archived" | "all";

async function listTeamScenes(actor: Actor, organizationId: string, state: SceneListState): Promise<SceneSummaryDto[]> {
  let query = db.selectFrom("scene").select(SCENE_COLUMNS).where("organization_id", "=", organizationId);
  if (state !== "all") query = query.where("state", "=", state);
  const scenes = await query.orderBy("updated_at", "desc").orderBy("id").execute();
  return buildSceneSummaries(db, actor, scenes);
}

/** GET /api/organizations/[id]/scenes: every scene of the team. */
export async function listOrganizationScenes(actor: Actor, organizationId: string, opts: { state?: SceneListState } = {}): Promise<SceneSummaryDto[]> {
  await requireOrgRead(db, actor, organizationId);
  return listTeamScenes(actor, organizationId, opts.state ?? "all");
}

export async function getScene(actor: Actor, sceneId: string): Promise<SceneDetailDto> {
  const { scene } = await requireSceneRead(db, actor, sceneId);
  return buildSceneDetail(db, actor, scene);
}

export async function listRevisions(actor: Actor, sceneId: string): Promise<SceneRevisionSummaryDto[]> {
  await requireSceneRead(db, actor, sceneId);
  const rows = await db
    .selectFrom("scene_revision as r")
    .select([
      "r.id",
      "r.scene_id",
      "r.revision_no",
      "r.source_lock_version",
      "r.name",
      "r.created_by",
      "r.created_at",
      (eb) =>
        eb
          .selectFrom("placement as p")
          .select(({ fn }) => fn.countAll<number>().as("n"))
          .whereRef("p.scene_revision_id", "=", "r.id")
          .where("p.status", "<>", "archived")
          .as("placement_count"),
    ])
    .where("r.scene_id", "=", sceneId)
    .orderBy("r.revision_no", "desc")
    .execute();
  return rows.map((r) => ({ ...r, created_at: toIsoRequired(r.created_at), placement_count: Number(r.placement_count ?? 0) }));
}

// ───────────────────────── commands ─────────────────────────

function parseCreateScene(body: JsonRecord) {
  rejectUnknown(body, ["name", "document", "idempotencyKey"]);
  return {
    name: requireString(body.name, "name", { max: 200 }),
    document: body.document === undefined ? createBlankSceneDocument() : parseDocument(body.document),
    key: optionalIdempotencyKey(body.idempotencyKey),
  };
}

/** Insert a team scene (caller holds the write locks); `workspaceId` is origin metadata only. */
async function insertSceneTx(
  trx: Trx,
  actor: Actor,
  writer: OrgAccess,
  input: { name: string; document: SceneDocumentV3; workspaceId: string | null },
): Promise<string> {
  const scene = await trx
    .insertInto("scene")
    .values({
      organization_id: writer.org.id,
      workspace_id: input.workspaceId,
      name: input.name,
      draft_document: JSON.stringify(input.document),
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .returning(["id", "organization_id"])
    .executeTakeFirstOrThrow();
  await syncDraftRefs(trx, actor, scene, writer, input.document);
  return scene.id;
}

/** POST /api/organizations/[id]/scenes: a team scene without any collection. */
export async function createOrganizationScene(actor: Actor, organizationId: string, body: JsonRecord): Promise<SceneDetailDto> {
  const { name, document, key } = parseCreateScene(body);
  const org = await requireOrgWrite(db, actor, organizationId);
  const sceneId = await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, organizationId);
    const scope = key ? { actorId: actor.userId, command: "scene.create", key, hash: requestHash({ organizationId, name, document }) } : null;
    if (scope) {
      const previous = await claimIdempotency(trx, scope);
      if (previous) return previous;
    }
    const id = await insertSceneTx(trx, actor, org, { name, document, workspaceId: null });
    if (scope) await recordIdempotency(trx, scope, organizationId, "scene", id);
    await audit(trx, { organizationId, actorId: actor.userId, action: "scene.create", objectType: "scene", objectId: id });
    return id;
  });
  return getScene(actor, sceneId);
}


/**
 * PATCH /api/scenes/[id]: save draft / rename / archive / restore. One
 * transaction: permission, version ownership and use checks, conditional
 * update on lock_version, derived index rebuild. 428 without a lock, 409 when
 * stale; the client keeps its local copy on failure.
 */
export async function saveScene(actor: Actor, sceneId: string, body: JsonRecord): Promise<SceneDetailDto> {
  rejectUnknown(body, ["expectedLockVersion", "name", "document", "state"]);
  const expected = body.expectedLockVersion === undefined ? undefined : requireInt(body.expectedLockVersion, "expectedLockVersion", 0);
  const name = body.name === undefined ? undefined : requireString(body.name, "name", { max: 200 });
  const document = body.document === undefined ? undefined : parseDocument(body.document);
  const state = body.state === undefined ? undefined : requireEnum(body.state, "state", ["active", "archived"] as const);
  const { scene: pre, access } = await requireSceneWrite(db, actor, sceneId);
  await contentTransaction(async (trx) => {
    await lockOrgForWrite(trx, pre.organization_id);
    const scene = await loadSceneRow(trx, sceneId, true);
    if (!scene) throw notFound("场景不存在");
    checkLockVersion(expected, scene.lock_version, "场景");
    const restoring = state === "active" && scene.state === "archived";
    const archiving = state === "archived" && scene.state !== "archived";
    if (scene.state === "archived" && !restoring) throw archived("场景已归档，请先恢复再编辑");
    if (archiving && (document || name)) throw invalid("归档时不能同时修改内容");
    if (document) await syncDraftRefs(trx, actor, scene, access, document);
    if (!document && name === undefined && !restoring && !archiving) return;
    await trx
      .updateTable("scene")
      .set((eb) => ({
        ...(name !== undefined ? { name } : {}),
        ...(document ? { draft_document: JSON.stringify(document) } : {}),
        ...(archiving ? { state: "archived", archived_at: sql<Date>`now()` } : {}),
        ...(restoring ? { state: "active", archived_at: null } : {}),
        lock_version: eb("lock_version", "+", 1),
        updated_by: actor.userId,
        updated_at: sql<Date>`now()`,
      }))
      .where("id", "=", sceneId)
      .where("lock_version", "=", scene.lock_version)
      .execute();
    await audit(trx, {
      organizationId: scene.organization_id,
      actorId: actor.userId,
      action: archiving ? "scene.archive" : restoring ? "scene.restore" : "scene.save",
      objectType: "scene",
      objectId: sceneId,
      workspaceId: scene.workspace_id,
      details: { from_lock_version: scene.lock_version },
    });
  });
  return getScene(actor, sceneId);
}

/**
 * POST /api/scenes/[id]/publish: freeze the draft at `expectedLockVersion`.
 * Retrying the same lock version returns the existing revision (unique
 * (scene_id, source_lock_version)), so retries never double-publish.
 */
export async function publishScene(actor: Actor, sceneId: string, body: JsonRecord): Promise<PublishSceneResult> {
  rejectUnknown(body, ["expectedLockVersion", "updatePlacements"]);
  const expected = body.expectedLockVersion === undefined ? undefined : requireInt(body.expectedLockVersion, "expectedLockVersion", 0);
  if (expected === undefined) throw new ContentError("LOCK_VERSION_REQUIRED", "发布需要提供 expectedLockVersion");
  const updates = parsePlacementUpdates(body.updatePlacements);
  const { scene: pre } = await requireSceneWrite(db, actor, sceneId);
  const outcome = await contentTransaction(async (trx) => {
    // Lock order: organization → scene row → placement collections → placement rows.
    await lockOrgForWrite(trx, pre.organization_id);
    const scene = await loadSceneRow(trx, sceneId, true);
    if (!scene) throw notFound("场景不存在");
    // An archived scene neither publishes nor replays an older publication onto placements.
    if (scene.state === "archived") throw archived("场景已归档，不能发布");
    let revision = await trx
      .selectFrom("scene_revision")
      .select(["id", "revision_no", "document"])
      .where("scene_id", "=", sceneId)
      .where("source_lock_version", "=", expected)
      .executeTakeFirst();
    let created = false;
    if (!revision) {
      checkLockVersion(expected, scene.lock_version, "场景");
      const document = parseDocument(scene.draft_document);
      const refs = await trx.selectFrom("scene_asset_ref").selectAll().where("scene_id", "=", sceneId).execute();
      const refByAlias = new Map(refs.map((r) => [r.resource_alias, r]));
      const aliases = Object.entries(document.content.assets);
      if (refs.length !== aliases.length || aliases.some(([alias, ref]) => refByAlias.get(alias)?.asset_version_id !== ref.assetVersionId.toLowerCase()))
        throw new ContentError("LOCK_VERSION_CONFLICT", "草稿引用索引与文档不一致，请重新保存后发布");
      const versionIds = refs.map((r) => r.asset_version_id);
      if (versionIds.length) {
        const files = await trx.selectFrom("asset_version_resource").select("asset_version_id").where("asset_version_id", "in", versionIds).where("role", "=", "primary").execute();
        const withFile = new Set(files.map((f) => f.asset_version_id));
        const missing = refs.filter((r) => !withFile.has(r.asset_version_id)).map((r) => r.resource_alias);
        if (missing.length) throw invalid(`资源 ${missing.join(", ")} 缺少文件，不能发布`);
        const payloads = await trx.selectFrom("asset_version").select(["id", "payload"]).where("id", "in", versionIds).execute();
        const animByVersion = new Map(payloads.map((p) => [p.id, animationsOf(p.payload)]));
        const issues = clipIssues(document, Object.fromEntries(refs.map((r) => [r.resource_alias, animByVersion.get(r.asset_version_id)])));
        if (issues.length) throw invalid("动画配置与固定版本不一致", issues);
      }
      const last = await trx.selectFrom("scene_revision").select(({ fn }) => fn.max("revision_no").as("max")).where("scene_id", "=", sceneId).executeTakeFirst();
      const inserted = await trx
        .insertInto("scene_revision")
        .values({
          scene_id: sceneId,
          organization_id: scene.organization_id,
          revision_no: Number(last?.max ?? 0) + 1,
          source_lock_version: scene.lock_version,
          name: scene.name,
          document: JSON.stringify(document),
          created_by: actor.userId,
        })
        .returning(["id", "revision_no", "document"])
        .executeTakeFirstOrThrow();
      if (refs.length)
        await trx
          .insertInto("scene_revision_asset_ref")
          .values(refs.map((r) => ({
            scene_revision_id: inserted.id,
            organization_id: scene.organization_id,
            resource_alias: r.resource_alias,
            asset_id: r.asset_id,
            asset_version_id: r.asset_version_id,
          })))
          .execute();
      await audit(trx, {
        organizationId: scene.organization_id,
        actorId: actor.userId,
        action: "scene.publish",
        objectType: "scene_revision",
        objectId: inserted.id,
        workspaceId: scene.workspace_id,
        details: { scene_id: sceneId, revision_no: inserted.revision_no, source_lock_version: scene.lock_version },
      });
      revision = inserted;
      created = true;
    }
    const instanceCount = isRecord(revision.document) && isRecord(revision.document.content) && Array.isArray(revision.document.content.instances)
      ? revision.document.content.instances.length
      : 0;
    // "Publish and update current placements": only placements of this scene, each re-checked.
    const updated: string[] = [];
    const sortedUpdates = [...updates].sort((a, b) => a.placementId.localeCompare(b.placementId));
    const owners = new Map<string, string>();
    for (const { placementId } of sortedUpdates) {
      const owner = await trx.selectFrom("placement").select("workspace_id").where("id", "=", placementId).executeTakeFirst();
      if (!owner) throw notFound("投放不存在");
      owners.set(placementId, owner.workspace_id);
    }
    for (const workspaceId of [...new Set(owners.values())].sort()) {
      const collection = await loadWorkspaceAccess(trx, actor, workspaceId);
      assertPlacementWritable(collection);
      await lockWorkspaceForWrite(trx, collection);
    }
    for (const { placementId, expectedLockVersion } of sortedUpdates) {
      const placement = await lockPlacement(trx, placementId);
      const current = placement.scene_revision_id
        ? await trx.selectFrom("scene_revision").select("scene_id").where("id", "=", placement.scene_revision_id).executeTakeFirst()
        : undefined;
      if (current?.scene_id !== sceneId) throw invalid(`投放 ${placementId} 不是该场景的投放`);
      const target = await loadWorkspaceAccess(trx, actor, placement.workspace_id);
      assertPlacementWritable(target);
      checkLockVersion(expectedLockVersion, placement.lock_version, "投放");
      if (placement.scene_revision_id === revision.id) continue;
      if (placement.status === "active" && instanceCount === 0) throw invalid("空场景不能用于有效投放");
      await trx
        .updateTable("placement")
        .set((eb) => ({ scene_revision_id: revision!.id, lock_version: eb("lock_version", "+", 1), updated_by: actor.userId, updated_at: sql<Date>`now()` }))
        .where("id", "=", placementId)
        .execute();
      await audit(trx, {
        organizationId: placement.organization_id,
        actorId: actor.userId,
        action: "placement.retarget",
        objectType: "placement",
        objectId: placementId,
        workspaceId: placement.workspace_id,
        details: { from_scene_revision_id: placement.scene_revision_id, to_scene_revision_id: revision.id },
      });
      updated.push(placementId);
    }
    return { revisionId: revision.id, created, updated };
  });
  const revisions = await listRevisions(actor, sceneId);
  const summary = revisions.find((r) => r.id === outcome.revisionId);
  if (!summary) throw new ContentError("INTERNAL", "发布版本读取失败");
  const rows = await loadPlacementRows(db, outcome.updated);
  const updatedPlacements: PlacementDto[] = await buildPlacementDtos(db, actor, rows);
  return { revision: summary, created: outcome.created, updated_placements: updatedPlacements };
}

function parsePlacementUpdates(value: unknown): { placementId: string; expectedLockVersion: number }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw invalid("updatePlacements 必须是不超过 100 项的数组");
  const updates = value.map((raw, i) => {
    if (!isRecord(raw)) throw invalid(`updatePlacements[${i}] 必须是对象`);
    rejectUnknown(raw, ["placementId", "expectedLockVersion"], `updatePlacements[${i}] `);
    if (raw.expectedLockVersion === undefined)
      throw new ContentError("LOCK_VERSION_REQUIRED", `updatePlacements[${i}] 缺少 expectedLockVersion`);
    return {
      placementId: requireUuid(raw.placementId, `updatePlacements[${i}].placementId`),
      expectedLockVersion: requireInt(raw.expectedLockVersion, `updatePlacements[${i}].expectedLockVersion`, 0),
    };
  });
  if (new Set(updates.map((u) => u.placementId)).size !== updates.length) throw invalid("updatePlacements 中的投放重复");
  return updates;
}

/**
 * POST /api/scenes/[id]/copy: new editable team scene in the same
 * organization, pinned to the same versions (every alias is a new use, so
 * archived assets block the copy). `targetWorkspaceId` (optional) only
 * records an origin collection, which must be open and in the same team.
 */
export async function copyScene(actor: Actor, sceneId: string, body: JsonRecord): Promise<SceneDetailDto> {
  rejectUnknown(body, ["targetWorkspaceId", "name", "idempotencyKey"]);
  const targetId = body.targetWorkspaceId === undefined || body.targetWorkspaceId === null ? null : requireUuid(body.targetWorkspaceId, "targetWorkspaceId");
  const key = optionalIdempotencyKey(body.idempotencyKey);
  const { scene: source, access } = await requireSceneWrite(db, actor, sceneId);
  const workspace = targetId ? await requireWorkspaceEdit(db, actor, targetId) : null;
  if (workspace && workspace.workspace.organization_id !== source.organization_id) throw invalid("只能复制到同一组织的合集");
  const writer: OrgAccess = workspace ?? access;
  const name = body.name === undefined ? `${source.name} 副本` : requireString(body.name, "name", { max: 200 });
  const newId = await contentTransaction(async (trx) => {
    if (workspace) await lockWorkspaceForWrite(trx, workspace);
    else await lockOrgForWrite(trx, source.organization_id);
    const scope = key ? { actorId: actor.userId, command: "scene.copy", key, hash: requestHash({ sceneId, targetId, name }) } : null;
    if (scope) {
      const previous = await claimIdempotency(trx, scope);
      if (previous) return previous;
    }
    const current = await loadSceneRow(trx, sceneId);
    if (!current) throw notFound("场景不存在");
    const document = parseDocument(current.draft_document);
    const id = await insertSceneTx(trx, actor, writer, { name, document, workspaceId: targetId });
    if (scope) await recordIdempotency(trx, scope, source.organization_id, "scene", id);
    await audit(trx, {
      organizationId: source.organization_id,
      actorId: actor.userId,
      action: "scene.copy",
      objectType: "scene",
      objectId: id,
      workspaceId: targetId,
      details: { source_scene_id: sceneId, source_lock_version: current.lock_version },
    });
    return id;
  });
  return getScene(actor, newId);
}

/** Revision document + pinned files, for compilation and placement resolution. */
export async function loadRevisionForPlayback(exec: Executor, revisionId: string) {
  const revision = await exec.selectFrom("scene_revision").select(["id", "scene_id", "organization_id", "document"]).where("id", "=", revisionId).executeTakeFirst();
  if (!revision) return null;
  const refs = await exec
    .selectFrom("scene_revision_asset_ref")
    .select(["resource_alias", "asset_id", "asset_version_id"])
    .where("scene_revision_id", "=", revisionId)
    .execute();
  return { revision, resources: await resolvePinnedResources(exec, refs) };
}
