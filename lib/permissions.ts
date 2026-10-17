/**
 * Two-tier permission system configuration
 *
 * Tier 1: Global role (users.role)
 *   - super_admin: Full system access, can CRUD organizations, manage user roles
 *   - user: Normal user, controlled by Tier 2 org roles
 *
 * Tier 2: Organization (team) role (organization_member.role) — the only
 * content permission boundary. Every member reads all team content.
 *   - owner: Full org control (settings, members, ownership, delete) + content
 *   - admin: Manage members (except owners) + content
 *   - member: Create, edit, version, archive team content and map collections
 *   - viewer: Read-only
 */

// --- Tier 1: Global roles ---
export type GlobalRole = "super_admin" | "user";

// --- Tier 2: Organization roles ---
export type OrgRole = "owner" | "admin" | "member" | "viewer";

// --- Permission keys ---
export type OrgPermission =
  | "org.view"
  | "org.settings"
  | "org.delete"
  | "org.members.view"
  | "org.members.add"
  | "org.members.remove"
  | "org.members.changeRole"
  | "org.members.manageOwners"
  | "org.workspaces.view"
  | "org.workspaces.create"
  | "org.workspaces.edit"
  | "org.workspaces.delete"
  | "org.assets.write"
  | "org.collections.manage";

export type GlobalPermission =
  | "global.users.view"
  | "global.users.changeRole"
  | "global.organizations.create"
  | "global.organizations.viewAll";

// --- Permission matrix for org roles ---
const ORG_PERMISSION_MATRIX: Record<OrgRole, OrgPermission[]> = {
  owner: [
    "org.view",
    "org.settings",
    "org.delete",
    "org.members.view",
    "org.members.add",
    "org.members.remove",
    "org.members.changeRole",
    "org.members.manageOwners",
    "org.workspaces.view",
    "org.workspaces.create",
    "org.workspaces.edit",
    "org.workspaces.delete",
    "org.assets.write",
    "org.collections.manage",
  ],
  admin: [
    "org.view",
    "org.members.view",
    "org.members.add",
    "org.members.remove",
    "org.members.changeRole",
    "org.workspaces.view",
    "org.workspaces.create",
    "org.workspaces.edit",
    "org.workspaces.delete",
    "org.assets.write",
    "org.collections.manage",
  ],
  member: [
    "org.view",
    "org.members.view",
    "org.workspaces.view",
    "org.assets.write",
    "org.collections.manage",
  ],
  viewer: ["org.view", "org.workspaces.view"],
};

// --- Permission matrix for global roles ---
const GLOBAL_PERMISSION_MATRIX: Record<GlobalRole, GlobalPermission[]> = {
  super_admin: [
    "global.users.view",
    "global.users.changeRole",
    "global.organizations.create",
    "global.organizations.viewAll",
  ],
  user: [],
};

// --- Helper functions ---

/** Check if a global role has a specific global permission */
export function hasGlobalPermission(
  globalRole: string | undefined | null,
  permission: GlobalPermission,
): boolean {
  if (!globalRole) return false;
  const perms = GLOBAL_PERMISSION_MATRIX[globalRole as GlobalRole];
  return perms?.includes(permission) ?? false;
}

/** Check if an org role has a specific org permission */
export function hasOrgPermission(
  orgRole: string | undefined | null,
  permission: OrgPermission,
): boolean {
  if (!orgRole) return false;
  const perms = ORG_PERMISSION_MATRIX[orgRole as OrgRole];
  return perms?.includes(permission) ?? false;
}

/** Check if user is super_admin */
export function isSuperAdmin(globalRole: string | undefined | null): boolean {
  return globalRole === "super_admin";
}

/** Get all org permissions for a role */
export function getOrgPermissions(
  orgRole: string | undefined | null,
): OrgPermission[] {
  if (!orgRole) return [];
  return ORG_PERMISSION_MATRIX[orgRole as OrgRole] ?? [];
}

/**
 * Sidebar visibility config: which sidebar items are visible to which roles.
 * super_admin always sees everything.
 */
export const SIDEBAR_VISIBILITY: Record<
  string,
  {
    requireGlobal?: GlobalPermission;
    requireOrg?: OrgPermission;
  }
> = {
  "/admin": { requireOrg: "org.view" },
  "/admin/settings": { requireOrg: "org.settings" },
  "/admin/members": { requireOrg: "org.members.view" },
  "/admin/workspaces": { requireOrg: "org.workspaces.view" },
};

/** Check if a sidebar item should be visible */
export function isSidebarItemVisible(
  href: string,
  globalRole: string | undefined | null,
  orgRole: string | undefined | null,
): boolean {
  // super_admin always sees everything
  if (isSuperAdmin(globalRole)) return true;

  const config = SIDEBAR_VISIBILITY[href];
  if (!config) return true;

  // If requires global permission, check it
  if (config.requireGlobal) {
    return hasGlobalPermission(globalRole, config.requireGlobal);
  }

  // If requires org permission, check it
  if (config.requireOrg) {
    return hasOrgPermission(orgRole, config.requireOrg);
  }

  return true;
}

// --- Collection (workspace) roles: derived from the team role ---
//
// Workspace rows are map collections, not an access boundary. Every member of
// the organization reads every collection; owner/admin/member edit them and
// an org viewer is read-only. workspace_assignment rows are history only and
// never change the result. super_admin keeps its global bypass. Pure, so the
// same rule drives UI hints and server checks (lib/content-model/access.server.ts).

export type ProjectRole = "manager" | "editor" | "viewer";

const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { viewer: 1, editor: 2, manager: 3 };

export function isProjectRole(value: unknown): value is ProjectRole {
  return value === "manager" || value === "editor" || value === "viewer";
}

/** Role in every collection of the team, or null for non-members. */
export function teamProjectRole(orgRole: string | null | undefined): ProjectRole | null {
  if (orgRole === "owner" || orgRole === "admin") return "manager";
  if (orgRole === "member") return "editor";
  if (orgRole === "viewer") return "viewer";
  return null;
}

/**
 * @deprecated Assignments no longer grant or limit access; same as
 * `teamProjectRole(orgRole)`. The second argument is ignored.
 */
export function effectiveProjectRole(
  orgRole: string | null | undefined,
  _assignmentRole?: string | null,
): ProjectRole | null {
  return teamProjectRole(orgRole);
}

export function projectRoleAtLeast(role: ProjectRole | null | undefined, required: ProjectRole): boolean {
  return !!role && PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[required];
}

/** Org roles allowed to write content at all (viewer is a read-only cap). */
export function orgRoleCanWrite(orgRole: string | null | undefined): boolean {
  return orgRole === "owner" || orgRole === "admin" || orgRole === "member";
}

/** @deprecated Assignments are no longer written; kept for callers reading historical rows. */
export function assignmentRoleFor(orgRole: string | null | undefined, requested: ProjectRole = "editor"): ProjectRole {
  return orgRole === "viewer" ? "viewer" : requested;
}
