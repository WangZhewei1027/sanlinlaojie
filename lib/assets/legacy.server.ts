import "server-only";
import { db, sql } from "@/lib/db";
import { finiteNumber, MatchingError } from "@/lib/anchor-matching";
import { referenceUrl, trySyncAnchor } from "@/lib/anchor/embedding.server";
import {
  loadWorkspaceAccessMany,
  lockOrgForWrite,
  lockWorkspaceForWrite,
  requireWorkspaceEdit,
  type Actor,
  type OrgInfo,
  type WorkspaceAccess,
} from "@/lib/content-model/access.server";
import type { ContentModelState } from "@/lib/content-model/contracts";
import { ContentError, archived, checkLockVersion, forbidden, invalid, notFound } from "@/lib/content-model/errors";
import { isRecord, optionalInt, rejectUnknown, requireString, type JsonRecord } from "@/lib/content-model/input";
import { audit, contentTransaction, type Executor } from "@/lib/content-model/tx.server";
import { assetKeyFromUrl } from "@/lib/storage/oss";
import { isKeyProtected, lockObjectKeys } from "@/lib/storage/retention.server";

/**
 * Legacy asset rows (`asset.workspace_id uuid[]`) behind the old
 * administrative paths. Authorization uses the shared team rules: editing a
 * row needs team write rights in every organization its collections belong
 * to, and every one of those collections open. Anchors keep their asset
 * identity and collection list in every state and get a small dedicated
 * service under the v2 contract (plan §4.4, §8.2).
 */

export interface LegacyRow {
  id: string;
  file_type: string;
  file_url: string | null;
  metadata: Record<string, unknown> | null;
  workspace_id: string[] | null;
  organization_id: string | null;
  lock_version: number;
}

export async function loadLegacyRow(exec: Executor, assetId: string): Promise<LegacyRow | null> {
  const row = await exec
    .selectFrom("asset")
    .select(["id", "file_type", "file_url", "metadata", "workspace_id", "organization_id", "lock_version"])
    .where("id", "=", assetId)
    .executeTakeFirst();
  if (!row) return null;
  return { ...row, metadata: isRecord(row.metadata) ? row.metadata : null };
}

/** Every organization a row touches (identity org + orgs of its legacy workspaces). */
export async function rowOrganizations(exec: Executor, rows: { organization_id: string | null; workspace_id: string[] | null }[]): Promise<OrgInfo[]> {
  const workspaceIds = [...new Set(rows.flatMap((r) => r.workspace_id ?? []))];
  const orgIds = new Set(rows.map((r) => r.organization_id).filter((id): id is string => !!id));
  if (workspaceIds.length) {
    const ws = await exec.selectFrom("workspace").select("organization_id").where("id", "in", workspaceIds).execute();
    for (const w of ws) orgIds.add(w.organization_id);
  }
  if (!orgIds.size) return [];
  const orgs = await exec
    .selectFrom("organization")
    .select(["id", "name", "content_model_state", "content_model_changed_at", "archived_at"])
    .where("id", "in", [...orgIds])
    .execute();
  return orgs.map((o) => ({ ...o, content_model_state: o.content_model_state as ContentModelState }));
}

/** Team write rights for every collection of the row (the old cross-org "strictest rule"). */
export async function requireLegacyRowEdit(exec: Executor, actor: Actor, row: { workspace_id: string[] | null }): Promise<WorkspaceAccess[]> {
  if (actor.superAdmin) return [];
  const ids = [...new Set(row.workspace_id ?? [])];
  // Ids of collections that no longer exist are ignored, as before (plan §8.2 lists them as cleanup items).
  const access = ids.length ? await loadWorkspaceAccessMany(exec, actor, ids) : new Map<string, WorkspaceAccess>();
  if (!access.size) throw forbidden("资产没有有效的合集归属");
  for (const collection of access.values()) {
    if (!collection.canRead) throw forbidden();
    if (!collection.canEdit) {
      if (collection.workspace.archived_at || collection.org.archived_at) throw archived("合集已归档，内容只读");
      throw forbidden("需要资产所在每个团队的编辑权限");
    }
  }
  return [...access.values()];
}

/** Rows of organizations the caller does not belong to look missing (no state/existence oracle). */
export async function requireRowMembership(exec: Executor, actor: Actor, orgs: OrgInfo[]): Promise<void> {
  if (actor.superAdmin) return;
  if (!orgs.length) throw notFound("资源不存在");
  const memberships = await exec
    .selectFrom("organization_member")
    .select("organization_id")
    .where("user_id", "=", actor.userId)
    .where("organization_id", "in", orgs.map((o) => o.id))
    .execute();
  if (!memberships.length) throw notFound("资源不存在");
}

/**
 * Legacy-mode delete of a row the migration already staged (shadow versions,
 * grants or placements hang off the same identity). The old model stays the
 * source of truth: the row leaves every legacy surface by dropping its
 * project memberships; the migrator sees the source change and must retire or
 * re-stage it explicitly. Nothing is guessed or cascaded here.
 */
export async function retireStagedLegacyRow(assetId: string): Promise<void> {
  await db.updateTable("asset").set({ workspace_id: [], tag_ids: [] }).where("id", "=", assetId).execute();
}

// ───────────────────────── anchors under the v2 contract ─────────────────────────

/**
 * A reference image must be this actor's unexpired upload in this
 * organization, or a file the organization already references; another
 * tenant's or user's object is never adopted by URL.
 */
async function assertReferenceRetained(trx: Executor, fileUrl: string, actor: Actor, organizationId: string): Promise<void> {
  const key = assetKeyFromUrl(fileUrl);
  if (!key) throw invalid("匹配图片必须来自本平台的媒体存储");
  const receipt = await trx
    .selectFrom("upload_receipt")
    .select("id")
    .where("storage_key", "=", key)
    .where("created_by", "=", actor.userId)
    .where("organization_id", "=", organizationId)
    .where("expires_at", ">", sql<Date>`clock_timestamp()`)
    .executeTakeFirst();
  if (receipt) return;
  const owned = await trx
    .selectFrom("asset")
    .select("id")
    .where("file_url", "=", fileUrl)
    .where((eb) =>
      eb.or([
        eb("organization_id", "=", organizationId),
        eb(sql<boolean>`workspace_id && (select coalesce(array_agg(id), '{}'::uuid[]) from workspace where organization_id = ${organizationId}::uuid)`, "=", true),
      ]),
    )
    .executeTakeFirst();
  if (owned && (await isKeyProtected(trx, key))) return;
  throw new ContentError("RECEIPT_INVALID", "匹配图片的上传回执无效或已过期，请重新上传");
}

function anchorPoint(metadata: Record<string, unknown>): { lng: number; lat: number } {
  return {
    lat: finiteNumber(metadata.latitude, -90, 90, "latitude"),
    lng: finiteNumber(metadata.longitude, -180, 180, "longitude"),
  };
}

/** POST /api/workspaces/[id]/assets with X-Content-Model: 2 and file_type "anchor". */
export async function createAnchorV2(actor: Actor, workspaceId: string, body: JsonRecord) {
  rejectUnknown(body, ["file_type", "name", "file_url", "content_hash", "text_content", "location", "metadata"]);
  const name = requireString(body.name, "name", { max: 200 });
  if (typeof body.file_url !== "string") throw new MatchingError("请上传一张匹配图片");
  referenceUrl(body.file_url);
  const metadata = isRecord(body.metadata) ? body.metadata : {};
  const point = anchorPoint(metadata);
  const project = await requireWorkspaceEdit(db, actor, workspaceId);
  const row = await contentTransaction(async (trx) => {
    await lockWorkspaceForWrite(trx, project);
    const key = assetKeyFromUrl(body.file_url as string);
    if (key) await lockObjectKeys(trx, [key]);
    await assertReferenceRetained(trx, body.file_url as string, actor, project.workspace.organization_id);
    const created = await trx
      .insertInto("asset")
      .values({
        organization_id: project.workspace.organization_id,
        origin_workspace_id: workspaceId,
        maintained_by: actor.userId,
        origin: "team_upload",
        workspace_id: [workspaceId],
        created_by: actor.userId,
        file_type: "anchor",
        name,
        file_url: body.file_url as string,
        content_hash: typeof body.content_hash === "string" ? body.content_hash : null,
        text_content: typeof body.text_content === "string" ? body.text_content : null,
        location: `POINT(${point.lng} ${point.lat})`,
        metadata: JSON.stringify({ ...metadata, longitude: point.lng, latitude: point.lat }),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(trx, { organizationId: project.workspace.organization_id, actorId: actor.userId, action: "anchor.create", objectType: "asset", objectId: created.id, workspaceId });
    return created;
  });
  await trySyncAnchor(row);
  return row;
}

/** PATCH /api/assets/[id] with X-Content-Model: 2 on an anchor: name, image, coordinates, note. */
export async function updateAnchorV2(actor: Actor, assetId: string, body: JsonRecord) {
  rejectUnknown(body, ["expectedLockVersion", "name", "file_url", "content_hash", "text_content", "metadata"]);
  const expected = optionalInt(body.expectedLockVersion, "expectedLockVersion", 0);
  const pre = await loadLegacyRow(db, assetId);
  if (!pre || pre.file_type !== "anchor") throw notFound("匹配点不存在");
  await requireLegacyRowEdit(db, actor, pre);
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) throw new MatchingError("匹配点必须输入名称");
  if (body.file_url !== undefined) referenceUrl(body.file_url);
  const metadata = body.metadata === undefined ? undefined : isRecord(body.metadata) ? body.metadata : (() => { throw invalid("metadata 必须是对象"); })();
  const updated = await contentTransaction(async (trx) => {
    if (pre.organization_id) await lockOrgForWrite(trx, pre.organization_id);
    const row = await trx.selectFrom("asset").select(["lock_version", "metadata", "file_url", "organization_id", "workspace_id"]).where("id", "=", assetId).forUpdate().executeTakeFirstOrThrow();
    await requireLegacyRowEdit(trx, actor, row);
    checkLockVersion(expected, row.lock_version, "匹配点");
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) changes.name = (body.name as string).trim();
    if (body.text_content !== undefined) changes.text_content = typeof body.text_content === "string" ? body.text_content : null;
    if (body.file_url !== undefined && body.file_url !== row.file_url) {
      const key = assetKeyFromUrl(body.file_url as string);
      if (key) await lockObjectKeys(trx, [key]);
      if (!row.organization_id) throw invalid("匹配点尚未迁移，不能在新内容模型中更换图片");
      await assertReferenceRetained(trx, body.file_url as string, actor, row.organization_id);
      changes.file_url = body.file_url;
      if (typeof body.content_hash === "string") changes.content_hash = body.content_hash;
    }
    if (metadata) {
      const merged = { ...(isRecord(row.metadata) ? row.metadata : {}), ...metadata };
      if (metadata.latitude !== undefined || metadata.longitude !== undefined) {
        const point = anchorPoint(merged);
        changes.location = `POINT(${point.lng} ${point.lat})`;
      }
      changes.metadata = JSON.stringify(merged);
    }
    if (!Object.keys(changes).length) return trx.selectFrom("asset").selectAll().where("id", "=", assetId).executeTakeFirstOrThrow();
    const saved = await trx
      .updateTable("asset")
      .set((eb) => ({ ...changes, lock_version: eb("lock_version", "+", 1) }))
      .where("id", "=", assetId)
      .returningAll()
      .executeTakeFirstOrThrow();
    await audit(trx, { organizationId: row.organization_id, actorId: actor.userId, action: "anchor.update", objectType: "asset", objectId: assetId, details: { fields: Object.keys(changes) } });
    return saved;
  });
  if (body.file_url !== undefined && body.file_url !== pre.file_url) await trySyncAnchor(updated);
  return updated;
}

/** DELETE /api/assets/[id] with X-Content-Model: 2 on an anchor; refused while placements use it. */
export async function deleteAnchorV2(actor: Actor, assetId: string, expected: number | undefined): Promise<{ deleted: true; file_url: string | null }> {
  const pre = await loadLegacyRow(db, assetId);
  if (!pre || pre.file_type !== "anchor") throw notFound("匹配点不存在");
  await requireLegacyRowEdit(db, actor, pre);
  await contentTransaction(async (trx) => {
    if (pre.organization_id) await lockOrgForWrite(trx, pre.organization_id);
    const row = await trx.selectFrom("asset").select(["lock_version", "organization_id", "workspace_id"]).where("id", "=", assetId).forUpdate().executeTakeFirstOrThrow();
    checkLockVersion(expected, row.lock_version, "匹配点");
    const users = await trx.selectFrom("placement").select(({ fn }) => fn.countAll<number>().as("n")).where("anchor_id", "=", assetId).executeTakeFirstOrThrow();
    if (Number(users.n) > 0) throw new ContentError("DEPENDENCY_CONFLICT", `仍有 ${users.n} 个投放使用该匹配点`);
    await trx.deleteFrom("asset").where("id", "=", assetId).execute();
    await audit(trx, { organizationId: row.organization_id, actorId: actor.userId, action: "anchor.delete", objectType: "asset", objectId: assetId });
  });
  return { deleted: true, file_url: pre.file_url };
}

/** Rows of a legacy list query restricted to the given collections. */
export function legacyWorkspaceFilter(workspaceIds: string[]) {
  return sql<boolean>`workspace_id && ${workspaceIds}::uuid[]`;
}
