import "server-only";
import { sql } from "@/lib/db";
import {
  effectiveProjectRole,
  isSuperAdmin,
  orgRoleCanWrite,
  projectRoleAtLeast,
  type OrgRole,
  type ProjectRole,
} from "@/lib/permissions";
import type {
  AssetCapabilities,
  ContentModelState,
  OrganizationCapabilities,
  WorkspaceCapabilities,
} from "./contracts";
import { ContentError, archived, forbidden, notFound } from "./errors";
import { audit, grantLockKey, lockKeys, type Executor, type Trx } from "./tx.server";

/**
 * Shared server-side authorization (plan §5.1). Every new and legacy route
 * resolves access through these helpers; UI capability flags are produced
 * from the same objects, never re-derived on the client.
 */

export interface Actor {
  userId: string;
  globalRole: string | null;
  superAdmin: boolean;
}

export async function loadActor(exec: Executor, userId: string): Promise<Actor> {
  const row = await exec.selectFrom("users").select("role").where("user_id", "=", userId).executeTakeFirst();
  const globalRole = row?.role ?? null;
  return { userId, globalRole, superAdmin: isSuperAdmin(globalRole) };
}

// ───────────────────────── organizations ─────────────────────────

export interface OrgInfo {
  id: string;
  name: string;
  content_model_state: ContentModelState;
  content_model_changed_at: Date | null;
  archived_at: Date | null;
}

export interface OrgAccess {
  org: OrgInfo;
  orgRole: OrgRole | null;
  canRead: boolean;
  /** owner/admin (or super_admin): implicit manager of every project. */
  canAdminister: boolean;
  /** Org role allows content writes at all (viewer is read-only). */
  canWrite: boolean;
}

function asOrgRole(value: string | null | undefined): OrgRole | null {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer" ? value : null;
}

function asState(value: string): ContentModelState {
  return value === "preparing" || value === "readonly" || value === "v2" ? value : "legacy";
}

function orgAccessFrom(actor: Actor, org: OrgInfo, role: string | null | undefined): OrgAccess {
  const orgRole = asOrgRole(role);
  return {
    org,
    orgRole,
    canRead: actor.superAdmin || orgRole !== null,
    canAdminister: actor.superAdmin || orgRole === "owner" || orgRole === "admin",
    canWrite: actor.superAdmin || orgRoleCanWrite(orgRole),
  };
}

export async function loadOrgAccess(exec: Executor, actor: Actor, orgId: string): Promise<OrgAccess | null> {
  const row = await exec
    .selectFrom("organization as o")
    .leftJoin("organization_member as m", (join) => join.onRef("m.organization_id", "=", "o.id").on("m.user_id", "=", actor.userId))
    .select(["o.id", "o.name", "o.content_model_state", "o.content_model_changed_at", "o.archived_at", "m.role"])
    .where("o.id", "=", orgId)
    .executeTakeFirst();
  if (!row) return null;
  return orgAccessFrom(actor, {
    id: row.id,
    name: row.name,
    content_model_state: asState(row.content_model_state),
    content_model_changed_at: row.content_model_changed_at,
    archived_at: row.archived_at,
  }, row.role);
}

export async function requireOrgRead(exec: Executor, actor: Actor, orgId: string): Promise<OrgAccess> {
  const access = await loadOrgAccess(exec, actor, orgId);
  if (!access) throw notFound("组织不存在");
  if (!access.canRead) throw forbidden();
  return access;
}

export function orgCapabilities(access: OrgAccess, actor: Actor): OrganizationCapabilities {
  return { can_read: access.canRead, can_administer: access.canAdminister, can_manage_content_model: actor.superAdmin };
}

/** Writers of the v2 model: the organization must be cut over and open. */
export function assertV2Writable(org: OrgInfo): void {
  if (org.archived_at) throw archived("组织已归档，内容只读");
  if (org.content_model_state === "readonly")
    throw new ContentError("CONTENT_MODEL_READONLY", "组织正在切换内容模型，暂时只读", { content_model_state: org.content_model_state });
  if (org.content_model_state !== "v2")
    throw new ContentError("CONTENT_MODEL_NOT_ENABLED", "该组织尚未启用新内容模型", { content_model_state: org.content_model_state });
}

/**
 * Legacy administrative write paths. Returns which model the request must be
 * served by: unchanged legacy behaviour, or the v2 adapter (only with the
 * explicit X-Content-Model: 2 contract). Mixed scopes are never guessed.
 */
export function legacyPathMode(orgs: OrgInfo[], hasV2Header: boolean): "legacy" | "v2" {
  if (orgs.some((org) => org.archived_at)) throw archived("组织已归档，内容只读");
  if (orgs.some((org) => org.content_model_state === "readonly"))
    throw new ContentError("CONTENT_MODEL_READONLY", "组织正在切换内容模型，暂时只读", { content_model_state: "readonly" });
  const v2 = orgs.filter((org) => org.content_model_state === "v2").length;
  if (v2 === 0) return "legacy";
  if (!hasV2Header)
    throw new ContentError("CONTENT_MODEL_UPGRADE_REQUIRED", "该组织已切换到新内容模型，请刷新页面或升级客户端", { content_model_state: "v2" });
  if (v2 !== orgs.length) throw new ContentError("LEGACY_AMBIGUOUS", "旧记录同时属于已切换与未切换的组织，无法自动处理");
  return "v2";
}

/** Short-lived share lock so a concurrent cutover/archive cannot interleave with a write. */
export async function lockOrgForWrite(trx: Trx, orgId: string): Promise<OrgInfo> {
  const row = await trx
    .selectFrom("organization")
    .select(["id", "name", "content_model_state", "content_model_changed_at", "archived_at"])
    .where("id", "=", orgId)
    .forShare()
    .executeTakeFirst();
  if (!row) throw notFound("组织不存在");
  const org: OrgInfo = { ...row, content_model_state: asState(row.content_model_state) };
  assertV2Writable(org);
  return org;
}

// ───────────────────────── workspaces (projects) ─────────────────────────

export interface WorkspaceInfo {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  create_date: Date | null;
  archived_at: Date | null;
}

export interface WorkspaceAccess extends OrgAccess {
  workspace: WorkspaceInfo;
  assignmentRole: string | null;
  projectRole: ProjectRole | null;
  canEdit: boolean;
  canManage: boolean;
  capabilities: WorkspaceCapabilities;
}

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  create_date: Date | null;
  archived_at: Date | null;
  org_name: string;
  content_model_state: string;
  content_model_changed_at: Date | null;
  org_archived_at: Date | null;
  org_role: string | null;
  assignment_role: string | null;
}

function workspaceAccessFrom(actor: Actor, row: WorkspaceRow): WorkspaceAccess {
  const base = orgAccessFrom(actor, {
    id: row.organization_id,
    name: row.org_name,
    content_model_state: asState(row.content_model_state),
    content_model_changed_at: row.content_model_changed_at,
    archived_at: row.org_archived_at,
  }, row.org_role);
  const projectRole: ProjectRole | null = actor.superAdmin ? "manager" : effectiveProjectRole(base.orgRole, row.assignment_role);
  const open = !row.archived_at && !row.org_archived_at;
  const writable = actor.superAdmin || orgRoleCanWrite(base.orgRole);
  const canEdit = open && writable && projectRoleAtLeast(projectRole, "editor");
  const canManage = open && writable && projectRoleAtLeast(projectRole, "manager");
  return {
    ...base,
    workspace: {
      id: row.id,
      name: row.name,
      description: row.description,
      organization_id: row.organization_id,
      create_date: row.create_date,
      archived_at: row.archived_at,
    },
    assignmentRole: row.assignment_role,
    projectRole,
    canRead: projectRole !== null,
    canEdit,
    canManage,
    capabilities: {
      can_read: projectRole !== null,
      can_edit: canEdit,
      can_manage_members: canManage,
      can_assign_manager: canManage && base.canAdminister,
      can_archive: base.canAdminister && !row.org_archived_at,
    },
  };
}

function workspaceQuery(exec: Executor, actor: Actor) {
  return exec
    .selectFrom("workspace as w")
    .innerJoin("organization as o", "o.id", "w.organization_id")
    .leftJoin("organization_member as m", (join) => join.onRef("m.organization_id", "=", "o.id").on("m.user_id", "=", actor.userId))
    .leftJoin("workspace_assignment as a", (join) => join.onRef("a.workspace_id", "=", "w.id").on("a.user_id", "=", actor.userId))
    .select([
      "w.id",
      "w.name",
      "w.description",
      "w.organization_id",
      "w.create_date",
      "w.archived_at",
      "o.name as org_name",
      "o.content_model_state",
      "o.content_model_changed_at",
      "o.archived_at as org_archived_at",
      "m.role as org_role",
      "a.role as assignment_role",
    ]);
}

export async function loadWorkspaceAccess(exec: Executor, actor: Actor, workspaceId: string): Promise<WorkspaceAccess | null> {
  const row = await workspaceQuery(exec, actor).where("w.id", "=", workspaceId).executeTakeFirst();
  return row ? workspaceAccessFrom(actor, row) : null;
}

export async function loadWorkspaceAccessMany(exec: Executor, actor: Actor, workspaceIds: string[]): Promise<Map<string, WorkspaceAccess>> {
  const ids = [...new Set(workspaceIds)];
  if (!ids.length) return new Map();
  const rows = await workspaceQuery(exec, actor).where("w.id", "in", ids).execute();
  return new Map(rows.map((row) => [row.id, workspaceAccessFrom(actor, row)]));
}

/** Every project of an organization with the caller's access (for org-scope reads). */
export async function loadOrgWorkspaceAccess(exec: Executor, actor: Actor, orgId: string): Promise<WorkspaceAccess[]> {
  const rows = await workspaceQuery(exec, actor).where("w.organization_id", "=", orgId).orderBy("w.create_date", "desc").execute();
  return rows.map((row) => workspaceAccessFrom(actor, row));
}

export async function requireWorkspaceRead(exec: Executor, actor: Actor, workspaceId: string): Promise<WorkspaceAccess> {
  const access = await loadWorkspaceAccess(exec, actor, workspaceId);
  if (!access) throw notFound("项目不存在");
  // Outside the organization a project looks missing; members lacking an assignment get 403.
  if (!access.canRead) throw access.orgRole === null ? notFound("项目不存在") : forbidden("无权访问该项目");
  return access;
}

function explainEditDenied(access: WorkspaceAccess): never {
  if (access.org.archived_at) throw archived("组织已归档，内容只读");
  if (access.workspace.archived_at) throw archived("项目已归档，内容只读");
  throw forbidden("需要该项目的编辑权限");
}

export async function requireWorkspaceEdit(exec: Executor, actor: Actor, workspaceId: string): Promise<WorkspaceAccess> {
  const access = await requireWorkspaceRead(exec, actor, workspaceId);
  if (!access.canEdit) explainEditDenied(access);
  return access;
}

export async function requireWorkspaceManage(exec: Executor, actor: Actor, workspaceId: string): Promise<WorkspaceAccess> {
  const access = await requireWorkspaceRead(exec, actor, workspaceId);
  if (!access.canManage) {
    if (access.workspace.archived_at || access.org.archived_at) explainEditDenied(access);
    throw forbidden("需要项目管理员权限");
  }
  return access;
}

/** Inside a write transaction: block concurrent archive of the project and cutover of its org. */
export async function lockWorkspaceForWrite(trx: Trx, access: WorkspaceAccess): Promise<void> {
  await lockOrgForWrite(trx, access.workspace.organization_id);
  const row = await trx.selectFrom("workspace").select(["archived_at"]).where("id", "=", access.workspace.id).forShare().executeTakeFirst();
  if (!row) throw notFound("项目不存在");
  if (row.archived_at) throw archived("项目已归档，内容只读");
}

/** Workspace ids of an org the caller may read (null = all, for owner/admin/super_admin). */
export async function readableWorkspaceIds(exec: Executor, actor: Actor, orgAccess: OrgAccess): Promise<string[] | null> {
  if (orgAccess.canAdminister) return null;
  if (!orgAccess.orgRole) return [];
  const rows = await exec
    .selectFrom("workspace_assignment as a")
    .innerJoin("workspace as w", "w.id", "a.workspace_id")
    .select("w.id")
    .where("a.user_id", "=", actor.userId)
    .where("w.organization_id", "=", orgAccess.org.id)
    .where("a.role", "in", ["manager", "editor", "viewer"])
    .execute();
  return rows.map((row) => row.id);
}

// ───────────────────────── assets ─────────────────────────

export interface AssetIdentity {
  id: string;
  organization_id: string;
  name: string | null;
  file_type: string;
  visibility: string;
  state: string;
  origin: string;
  origin_workspace_id: string | null;
  maintained_by: string | null;
  current_version_id: string | null;
  lock_version: number;
  created_by: string | null;
}

export interface AssetAccess extends OrgAccess {
  asset: AssetIdentity;
  canMaintain: boolean;
  canTransfer: boolean;
}

const ASSET_COLUMNS = [
  "id",
  "organization_id",
  "name",
  "file_type",
  "visibility",
  "state",
  "origin",
  "origin_workspace_id",
  "maintained_by",
  "current_version_id",
  "lock_version",
  "created_by",
] as const;

/** v2 identity row; legacy rows without an organization are not addressable here. */
export async function loadAssetIdentity(exec: Executor, assetId: string, opts: { forUpdate?: boolean; forShare?: boolean } = {}): Promise<AssetIdentity | null> {
  let query = exec.selectFrom("asset").select(ASSET_COLUMNS).where("id", "=", assetId).where("organization_id", "is not", null);
  if (opts.forUpdate) query = query.forUpdate();
  else if (opts.forShare) query = query.forShare();
  const row = await query.executeTakeFirst();
  if (!row || !row.organization_id) return null;
  return { ...row, organization_id: row.organization_id };
}

async function hasGrantReadPath(exec: Executor, actor: Actor, assetId: string): Promise<boolean> {
  const row = await exec
    .selectFrom("asset_workspace_grant as g")
    .innerJoin("workspace_assignment as a", "a.workspace_id", "g.workspace_id")
    .select(sql<number>`1`.as("one"))
    .where("g.asset_id", "=", assetId)
    .where("a.user_id", "=", actor.userId)
    .limit(1)
    .executeTakeFirst();
  return !!row;
}

export function assetAccessFrom(org: OrgAccess, actor: Actor, asset: AssetIdentity, grantRead: boolean): AssetAccess {
  const member = org.orgRole !== null;
  const isMaintainer = asset.maintained_by === actor.userId && member;
  const canRead =
    org.canAdminister || isMaintainer || (member && asset.visibility === "organization") || (member && grantRead);
  const open = !org.org.archived_at;
  return {
    ...org,
    asset,
    canRead,
    canMaintain: open && (org.canAdminister || (isMaintainer && org.canWrite)),
    canTransfer: open && org.canAdminister,
  };
}

export async function loadAssetAccess(
  exec: Executor,
  actor: Actor,
  assetId: string,
  opts: { forUpdate?: boolean; forShare?: boolean } = {},
): Promise<AssetAccess | null> {
  const asset = await loadAssetIdentity(exec, assetId, opts);
  if (!asset) return null;
  const org = await loadOrgAccess(exec, actor, asset.organization_id);
  if (!org) return null;
  const grantRead = !org.canAdminister && org.orgRole !== null && asset.visibility !== "organization"
    ? await hasGrantReadPath(exec, actor, asset.id)
    : false;
  return assetAccessFrom(org, actor, asset, grantRead);
}

export async function requireAssetRead(exec: Executor, actor: Actor, assetId: string, opts: { forUpdate?: boolean; forShare?: boolean } = {}): Promise<AssetAccess> {
  const access = await loadAssetAccess(exec, actor, assetId, opts);
  // Unreadable and missing look the same: no existence oracle across tenants.
  if (!access || !access.canRead) throw notFound("素材不存在");
  return access;
}

export async function requireAssetMaintain(exec: Executor, actor: Actor, assetId: string, opts: { forUpdate?: boolean } = {}): Promise<AssetAccess> {
  const access = await requireAssetRead(exec, actor, assetId, opts);
  if (!access.canMaintain) {
    if (access.org.archived_at) throw archived("组织已归档，内容只读");
    throw forbidden("只有素材维护者或组织管理员可以修改源素材");
  }
  return access;
}

export function assetCapabilities(access: AssetAccess, useInWorkspace?: boolean): AssetCapabilities {
  return {
    can_read: access.canRead,
    can_maintain: access.canMaintain,
    can_transfer_maintainer: access.canTransfer,
    ...(useInWorkspace === undefined ? {} : { can_use_in_workspace: useInWorkspace }),
  };
}

/**
 * Use permission for bringing an asset into a project (plan §4.1, §5.1).
 * Must run inside the write transaction: takes the per-(asset, project) grant
 * lock — the same lock grant revocation takes — re-reads the asset under a
 * share lock and creates the stable grant when it is missing.
 *
 * `existingReference`: the exact version is already referenced by the caller's
 * draft/placement, so archived assets remain usable for that reference.
 */
export async function ensureAssetUse(
  trx: Trx,
  actor: Actor,
  assetId: string,
  target: WorkspaceAccess,
  opts: { existingReference?: boolean; viaLegacyScope?: boolean } = {},
): Promise<AssetIdentity> {
  if (!target.canEdit) explainEditDenied(target);
  await lockKeys(trx, [grantLockKey(assetId, target.workspace.id)]);
  const asset = await loadAssetIdentity(trx, assetId, { forShare: true });
  if (!asset || asset.organization_id !== target.workspace.organization_id) throw notFound("素材不存在或不属于该组织");
  if (asset.state !== "active" && !opts.existingReference) throw archived("素材已归档，不能新增引用");
  const grant = await trx
    .selectFrom("asset_workspace_grant")
    .select("asset_id")
    .where("asset_id", "=", assetId)
    .where("workspace_id", "=", target.workspace.id)
    .executeTakeFirst();
  if (grant) return asset;
  // A legacy scope lets the project copy that one fixed placement; it never
  // becomes a use grant (no catalog access, no reuse in new content).
  if (opts.viaLegacyScope) return asset;
  const isMaintainer = asset.maintained_by === actor.userId && target.orgRole !== null && target.canWrite;
  const mayGrant = asset.visibility === "organization" || target.canAdminister || isMaintainer;
  if (!mayGrant) throw new ContentError("GRANT_REQUIRED", "该素材未授权给此项目，请联系素材维护者");
  await trx
    .insertInto("asset_workspace_grant")
    .values({ asset_id: assetId, workspace_id: target.workspace.id, organization_id: asset.organization_id, created_by: actor.userId })
    .onConflict((oc) => oc.columns(["asset_id", "workspace_id"]).doNothing())
    .execute();
  await audit(trx, {
    organizationId: asset.organization_id,
    actorId: actor.userId,
    action: "asset.grant.create",
    objectType: "asset_grant",
    objectId: assetId,
    workspaceId: target.workspace.id,
    details: { reason: "use" },
  });
  return asset;
}
