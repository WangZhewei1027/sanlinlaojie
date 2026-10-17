import "server-only";
import { db, sql } from "@/lib/db";
import { isProjectRole, teamProjectRole } from "@/lib/permissions";
import {
  CONTENT_MODEL_STATES,
  type CollectionState,
  type ContentModelState,
  type OrganizationContentModelDto,
  type WorkspaceDto,
  type WorkspaceMemberDto,
  type WorkspaceMembersDto,
} from "./contracts";
import {
  loadOrgWorkspaceAccess,
  orgCapabilities,
  requireOrgRead,
  requireOrgWrite,
  requireWorkspaceEdit,
  requireWorkspaceManage,
  requireWorkspaceRead,
  type Actor,
  type OrgInfo,
  type WorkspaceAccess,
} from "./access.server";
import { ContentError, archived, deprecated, forbidden, invalid, notFound } from "./errors";
import { optionalString, rejectUnknown, requireEnum, requireString, type JsonRecord } from "./input";
import { audit, toIso, type Executor, type Trx } from "./tx.server";

// Map collections (workspace rows): create, rename, archive, and the
// organization's content-model cutover state. Collections own placements
// only; they carry no membership and never contain or change team assets or
// scenes. Every team writer manages them (team workbench contract §1).

export function workspaceDto(access: WorkspaceAccess): WorkspaceDto {
  return {
    id: access.workspace.id,
    name: access.workspace.name,
    description: access.workspace.description,
    organization_id: access.workspace.organization_id,
    create_date: toIso(access.workspace.create_date),
    archived_at: toIso(access.workspace.archived_at),
    project_role: access.projectRole,
    content_model_state: access.org.content_model_state,
    capabilities: access.capabilities,
  };
}

// ───────────────────────── collections ─────────────────────────

const COLLECTION_STATES: readonly CollectionState[] = ["active", "archived", "all"];

export function parseCollectionState(value: string | null): CollectionState {
  return value === null || value === "" ? "active" : requireEnum(value, "state", COLLECTION_STATES);
}

/**
 * Collection rows may change while the organization is open and not inside a
 * cutover freeze (the freeze snapshot covers workspace rows). Takes the
 * organization row FOR SHARE, like every content write.
 */
async function lockOrgForCollections(trx: Trx, organizationId: string): Promise<OrgInfo> {
  const row = await trx
    .selectFrom("organization")
    .select(["id", "name", "content_model_state", "content_model_changed_at", "archived_at"])
    .where("id", "=", organizationId)
    .forShare()
    .executeTakeFirst();
  if (!row) throw notFound("组织不存在");
  if (row.archived_at) throw archived("组织已归档，内容只读");
  if (row.content_model_state === "readonly")
    throw new ContentError("CONTENT_MODEL_READONLY", "组织正在切换内容模型，暂时只读", { content_model_state: "readonly" });
  return { ...row, content_model_state: row.content_model_state as ContentModelState };
}

function parseCollectionFields(body: JsonRecord, requireName: boolean): { name?: string; description?: string | null } {
  rejectUnknown(body, ["name", "description"]);
  const name = body.name === undefined && !requireName ? undefined : requireString(body.name, "name", { max: 200 });
  const description = optionalString(body.description, "description", { max: 1000 });
  return { name, description };
}

/** GET /api/organizations/[id]/collections: every collection of the team (newest first). */
export async function listCollections(actor: Actor, organizationId: string, opts: { state?: CollectionState } = {}): Promise<WorkspaceDto[]> {
  await requireOrgRead(db, actor, organizationId);
  const state = opts.state ?? "active";
  const all = await loadOrgWorkspaceAccess(db, actor, organizationId);
  return all
    .filter((access) => state === "all" || (state === "archived") === !!access.workspace.archived_at)
    .map(workspaceDto);
}

export async function getCollection(actor: Actor, workspaceId: string): Promise<WorkspaceDto> {
  return workspaceDto(await requireWorkspaceRead(db, actor, workspaceId));
}

/** POST /api/organizations/[id]/collections { name, description? } (any team writer). */
export async function createCollection(actor: Actor, organizationId: string, body: JsonRecord): Promise<WorkspaceDto> {
  const fields = parseCollectionFields(body, true);
  await requireOrgWrite(db, actor, organizationId);
  const id = await db.transaction().execute(async (trx) => {
    await lockOrgForCollections(trx, organizationId);
    const row = await trx
      .insertInto("workspace")
      .values({ name: fields.name!, description: fields.description ?? null, organization_id: organizationId })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(trx, { organizationId, actorId: actor.userId, action: "workspace.create", objectType: "workspace", objectId: row.id, workspaceId: row.id });
    return row.id;
  });
  return getCollection(actor, id);
}

/** PATCH /api/collections/[id] { name?, description? }: an open collection, any team writer. */
export async function updateCollection(actor: Actor, workspaceId: string, body: JsonRecord): Promise<WorkspaceDto> {
  const fields = parseCollectionFields(body, false);
  const access = await requireWorkspaceEdit(db, actor, workspaceId);
  const changes: { name?: string; description?: string | null } = {};
  if (fields.name !== undefined && fields.name !== access.workspace.name) changes.name = fields.name;
  if (fields.description !== undefined && fields.description !== access.workspace.description) changes.description = fields.description;
  if (Object.keys(changes).length) {
    await db.transaction().execute(async (trx) => {
      await lockOrgForCollections(trx, access.workspace.organization_id);
      const row = await trx.selectFrom("workspace").select("archived_at").where("id", "=", workspaceId).forUpdate().executeTakeFirst();
      if (!row) throw notFound("合集不存在");
      if (row.archived_at) throw archived("合集已归档，请先恢复");
      await trx.updateTable("workspace").set(changes).where("id", "=", workspaceId).execute();
      await audit(trx, {
        organizationId: access.workspace.organization_id,
        actorId: actor.userId,
        action: "workspace.update",
        objectType: "workspace",
        objectId: workspaceId,
        workspaceId,
        details: { changes, before: { name: access.workspace.name, description: access.workspace.description } },
      });
    });
  }
  return getCollection(actor, workspaceId);
}

/**
 * Archive (the default "delete" of a collection) or restore; any team
 * writer. Archiving only freezes the collection's placements and stops their
 * public entries; team assets and scenes are untouched.
 */
export async function setWorkspaceArchived(actor: Actor, workspaceId: string, archive: boolean): Promise<WorkspaceDto> {
  const access = await requireWorkspaceManage(db, actor, workspaceId);
  await db.transaction().execute(async (trx) => {
    await lockOrgForCollections(trx, access.workspace.organization_id);
    const row = await trx.selectFrom("workspace").select("archived_at").where("id", "=", workspaceId).forUpdate().executeTakeFirst();
    if (!row) throw notFound("合集不存在");
    if (!!row.archived_at === archive) return;
    await trx
      .updateTable("workspace")
      .set(archive ? { archived_at: sql<Date>`now()`, archived_by: actor.userId } : { archived_at: null, archived_by: null })
      .where("id", "=", workspaceId)
      .execute();
    await audit(trx, {
      organizationId: access.workspace.organization_id,
      actorId: actor.userId,
      action: archive ? "workspace.archive" : "workspace.restore",
      objectType: "workspace",
      objectId: workspaceId,
      workspaceId,
    });
  });
  return getCollection(actor, workspaceId);
}

// ───────────────────────── retired project membership ─────────────────────────

type OrgRoleName = WorkspaceMemberDto["org_role"];
const asOrgRole = (value: string): OrgRoleName => (value === "owner" || value === "admin" || value === "viewer" ? value : "member");

/**
 * GET /api/workspaces/[id]/members (compatibility, read-only): every team
 * member reaches every collection through the team role; recorded
 * assignment roles are history only.
 */
export async function listWorkspaceMembers(actor: Actor, workspaceId: string): Promise<WorkspaceMembersDto> {
  const access = await requireWorkspaceRead(db, actor, workspaceId);
  const rows = await db
    .selectFrom("organization_member as m")
    .innerJoin("users as u", "u.user_id", "m.user_id")
    .leftJoin("workspace_assignment as a", (join) => join.onRef("a.user_id", "=", "m.user_id").on("a.workspace_id", "=", workspaceId))
    .select(["m.user_id", "u.name", "u.email", "m.role as org_role", "a.role as assignment_role", "a.created_at as assigned_at"])
    .where("m.organization_id", "=", access.workspace.organization_id)
    .orderBy("m.created_at")
    .execute();
  const members: WorkspaceMemberDto[] = rows.map((row) => ({
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    org_role: asOrgRole(row.org_role),
    assignment_role: isProjectRole(row.assignment_role) ? row.assignment_role : null,
    effective_role: teamProjectRole(row.org_role) ?? "viewer",
    implicit: true,
    assigned_at: toIso(row.assigned_at),
  }));
  return { workspace_id: workspaceId, members, candidates: [], capabilities: access.capabilities };
}

const MEMBERSHIP_RETIRED = "合集成员已停用：团队成员按团队角色访问全部合集，请在团队成员中调整角色";

/** PUT /api/workspaces/[id]/members: retired (410); collections have no membership. */
export function putWorkspaceMember(): never {
  throw deprecated(MEMBERSHIP_RETIRED);
}

/** DELETE /api/workspaces/[id]/members: retired (410). */
export function removeWorkspaceMember(): never {
  throw deprecated(MEMBERSHIP_RETIRED);
}

export const PROJECT_ASSIGNMENTS_RETIRED = MEMBERSHIP_RETIRED;

// ───────────────────────── content model cutover state ─────────────────────────

async function legacyAssetCount(organizationId: string, exec: Executor = db): Promise<number> {
  const row = await exec
    .selectFrom("asset")
    .select(({ fn }) => fn.countAll<number>().as("n"))
    .where("organization_id", "is", null)
    .where(sql<boolean>`workspace_id && (select coalesce(array_agg(id), '{}'::uuid[]) from workspace where organization_id = ${organizationId}::uuid)`)
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function getContentModelState(actor: Actor, organizationId: string): Promise<OrganizationContentModelDto> {
  const access = await requireOrgRead(db, actor, organizationId);
  return {
    organization_id: organizationId,
    content_model_state: access.org.content_model_state,
    content_model_changed_at: toIso(access.org.content_model_changed_at),
    archived_at: toIso(access.org.archived_at),
    legacy_asset_count: await legacyAssetCount(organizationId),
    capabilities: orgCapabilities(access, actor),
  };
}

/**
 * PUT /api/organizations/[id]/content-model (super_admin). The only direct
 * transition is legacy → v2 for an organization that has no legacy asset rows
 * (new/empty organizations). Every organization with existing content goes
 * through the audited tooling in scripts/migrate/content-model (backfill →
 * verify → cutover / rollback with a state fingerprint), never this endpoint.
 */
export async function setContentModelState(actor: Actor, organizationId: string, body: JsonRecord): Promise<OrganizationContentModelDto> {
  rejectUnknown(body, ["state", "expectedState", "note"]);
  if (!actor.superAdmin) throw forbidden("只有超级管理员可以切换内容模型");
  const state = requireEnum(body.state, "state", CONTENT_MODEL_STATES);
  const expectedState = requireEnum(body.expectedState, "expectedState", CONTENT_MODEL_STATES);
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  await db.transaction().execute(async (trx) => {
    const org = await trx
      .selectFrom("organization")
      .select(["content_model_state"])
      .where("id", "=", organizationId)
      .forUpdate()
      .executeTakeFirst();
    if (!org) throw notFound("组织不存在");
    const current = org.content_model_state as ContentModelState;
    if (current !== expectedState) throw new ContentError("LOCK_VERSION_CONFLICT", `组织当前状态为 ${current}`, { content_model_state: current });
    if (current === state) return;
    if (!(current === "legacy" && state === "v2"))
      throw invalid("该切换必须通过 scripts/migrate/content-model 的 backfill / verify / cutover / rollback 流程执行");
    if ((await legacyAssetCount(organizationId, trx)) > 0)
      throw invalid("组织仍有旧素材记录，必须经过迁移流程");
    await trx
      .updateTable("organization")
      .set({ content_model_state: state, content_model_changed_at: sql<Date>`now()` })
      .where("id", "=", organizationId)
      .execute();
    await audit(trx, {
      organizationId,
      actorId: actor.userId,
      action: `organization.content_model.${state}`,
      objectType: "organization",
      objectId: organizationId,
      details: { from: current, to: state, note },
    });
  });
  return getContentModelState(actor, organizationId);
}
