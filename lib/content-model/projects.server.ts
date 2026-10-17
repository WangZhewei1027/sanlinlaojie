import "server-only";
import { db, sql } from "@/lib/db";
import { assignmentRoleFor, effectiveProjectRole, isProjectRole } from "@/lib/permissions";
import {
  CONTENT_MODEL_STATES,
  PROJECT_ROLES,
  type ContentModelState,
  type OrganizationContentModelDto,
  type ProjectRole,
  type WorkspaceDto,
  type WorkspaceMemberDto,
  type WorkspaceMembersDto,
} from "./contracts";
import {
  orgCapabilities,
  requireOrgRead,
  requireWorkspaceManage,
  requireWorkspaceRead,
  type Actor,
  type WorkspaceAccess,
} from "./access.server";
import { ContentError, archived, forbidden, invalid, notFound } from "./errors";
import { rejectUnknown, requireEnum, requireUuid, type JsonRecord } from "./input";
import { audit, toIso, type Executor } from "./tx.server";

// Projects (workspaces): members with project roles, archive, and the
// organization's content-model cutover state (plan §5.1, §5.2, §8.1).

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

type OrgRoleName = WorkspaceMemberDto["org_role"];
const asOrgRole = (value: string): OrgRoleName => (value === "owner" || value === "admin" || value === "viewer" ? value : "member");

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
  const members: WorkspaceMemberDto[] = [];
  const candidates: WorkspaceMembersDto["candidates"] = [];
  for (const row of rows) {
    const effective = effectiveProjectRole(row.org_role, row.assignment_role);
    if (!effective) {
      candidates.push({ user_id: row.user_id, name: row.name, email: row.email, org_role: row.org_role });
      continue;
    }
    const implicit = row.org_role === "owner" || row.org_role === "admin";
    members.push({
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      org_role: asOrgRole(row.org_role),
      assignment_role: isProjectRole(row.assignment_role) ? row.assignment_role : null,
      effective_role: effective,
      implicit,
      assigned_at: toIso(row.assigned_at),
    });
  }
  return { workspace_id: workspaceId, members, candidates: access.canManage ? candidates : [], capabilities: access.capabilities };
}

/**
 * PUT /api/workspaces/[id]/members. Project managers may hand out editor /
 * viewer to existing org members; only owner/admin may grant or change a
 * manager. Org viewers are always stored as viewer.
 */
export async function putWorkspaceMember(actor: Actor, workspaceId: string, body: JsonRecord): Promise<WorkspaceMemberDto> {
  rejectUnknown(body, ["userId", "role"]);
  const userId = requireUuid(body.userId, "userId");
  const requested = requireEnum(body.role, "role", PROJECT_ROLES);
  const access = await requireWorkspaceManage(db, actor, workspaceId);
  const member = await db
    .selectFrom("organization_member as m")
    .innerJoin("users as u", "u.user_id", "m.user_id")
    .select(["m.role", "u.name", "u.email"])
    .where("m.organization_id", "=", access.workspace.organization_id)
    .where("m.user_id", "=", userId)
    .executeTakeFirst();
  if (!member) throw invalid("只能分配本组织的成员");
  if (member.role === "owner" || member.role === "admin") throw invalid("组织拥有者和管理员已隐式拥有项目管理权限");
  if (!access.canAdminister && requested === "manager") throw forbidden("只有组织拥有者或管理员可以授予或调整项目管理员");
  const role: ProjectRole = assignmentRoleFor(member.role, requested);
  const row = await db.transaction().execute(async (trx) => {
    // Re-read under a row lock so a concurrent promotion cannot be overwritten by a manager.
    const existing = await trx
      .selectFrom("workspace_assignment")
      .select("role")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .forUpdate()
      .executeTakeFirst();
    if (!access.canAdminister && existing?.role === "manager") throw forbidden("只有组织拥有者或管理员可以授予或调整项目管理员");
    const saved = await trx
      .insertInto("workspace_assignment")
      .values({ user_id: userId, workspace_id: workspaceId, role })
      .onConflict((oc) => oc.columns(["user_id", "workspace_id"]).doUpdateSet({ role }))
      .returning(["role", "created_at"])
      .executeTakeFirstOrThrow();
    await audit(trx, {
      organizationId: access.workspace.organization_id,
      actorId: actor.userId,
      action: "workspace.member.put",
      objectType: "workspace_member",
      objectId: userId,
      workspaceId,
      details: { role, requested, previous: existing?.role ?? null },
    });
    return saved;
  });
  return {
    user_id: userId,
    name: member.name,
    email: member.email,
    org_role: asOrgRole(member.role),
    assignment_role: role,
    effective_role: effectiveProjectRole(member.role, row.role) ?? "viewer",
    implicit: false,
    assigned_at: toIso(row.created_at),
  };
}

export async function removeWorkspaceMember(actor: Actor, workspaceId: string, userId: string): Promise<{ removed: boolean }> {
  const access = await requireWorkspaceManage(db, actor, workspaceId);
  const existing = await db
    .selectFrom("workspace_assignment")
    .select("role")
    .where("workspace_id", "=", workspaceId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return { removed: false };
  if (existing.role === "manager" && !access.canAdminister) throw forbidden("只有组织拥有者或管理员可以移除项目管理员");
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("workspace_assignment").where("workspace_id", "=", workspaceId).where("user_id", "=", userId).execute();
    await audit(trx, {
      organizationId: access.workspace.organization_id,
      actorId: actor.userId,
      action: "workspace.member.remove",
      objectType: "workspace_member",
      objectId: userId,
      workspaceId,
      details: { previous: existing.role },
    });
  });
  return { removed: true };
}

/** Archive (default "delete" of a project) or restore. Owner/admin only. */
export async function setWorkspaceArchived(actor: Actor, workspaceId: string, archive: boolean): Promise<WorkspaceDto> {
  const access = await requireWorkspaceRead(db, actor, workspaceId);
  if (!access.canAdminister) throw forbidden("只有组织拥有者或管理员可以归档项目");
  if (access.org.archived_at) throw archived("组织已归档");
  await db.transaction().execute(async (trx) => {
    const row = await trx.selectFrom("workspace").select("archived_at").where("id", "=", workspaceId).forUpdate().executeTakeFirst();
    if (!row) throw notFound("项目不存在");
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
  const updated = await requireWorkspaceRead(db, actor, workspaceId);
  return workspaceDto(updated);
}

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
