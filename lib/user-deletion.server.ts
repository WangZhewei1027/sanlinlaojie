import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 删除用户的服务端编排（仅服务端，配合 service-role admin client 使用）。
 *
 * 策略：用户是某组织唯一 owner 时——
 * - 组织还有其他成员 → 晋升最合适的成员为 owner（admin 优先，其次加入最早）；
 * - 只剩他一人 → 连同 workspace、资产、存储文件整体删除该组织。
 *
 * computeUserDeletionPlan 是预览 GET 与 DELETE 的单一事实来源；
 * purgeOrganizations 先按引用计数清理存储文件（内容 hash 去重会让多个资产
 * 共享同一 file_url），再调 purge_organizations RPC 原子删行。
 */

export type OrgDeletionAction = "none" | "promote" | "delete";

export interface OrgDeletionPlanItem {
  id: string;
  name: string;
  memberCount: number;
  action: OrgDeletionAction;
  successor?: {
    user_id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
  workspaceCount?: number;
  assetCount?: number;
}

export interface UserDeletionPlan {
  orgs: OrgDeletionPlanItem[];
  promoteOrgIds: string[];
  deleteOrgIds: string[];
}

interface MemberRow {
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  users: { name: string | null; email: string | null } | null;
}

const STORAGE_PATH_RE = /\/storage\/v1\/object\/public\/assets\/(.+)/;

export async function computeUserDeletionPlan(
  admin: SupabaseClient,
  targetUserId: string,
): Promise<UserDeletionPlan> {
  const { data: ownerRows, error: ownerError } = await admin
    .from("organization_member")
    .select("organization_id, organization(id, name)")
    .eq("user_id", targetUserId)
    .eq("role", "owner");

  if (ownerError) throw ownerError;

  const orgIds = (ownerRows ?? []).map((r) => r.organization_id as string);
  if (orgIds.length === 0) {
    return { orgs: [], promoteOrgIds: [], deleteOrgIds: [] };
  }

  const orgNames = new Map<string, string>();
  for (const row of ownerRows ?? []) {
    const org = row.organization as unknown as {
      id: string;
      name: string | null;
    } | null;
    orgNames.set(row.organization_id as string, org?.name ?? "");
  }

  const { data: memberRows, error: memberError } = await admin
    .from("organization_member")
    .select("organization_id, user_id, role, created_at, users(name, email)")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: true });

  if (memberError) throw memberError;

  const byOrg = new Map<string, MemberRow[]>();
  for (const row of (memberRows ?? []) as unknown as MemberRow[]) {
    const list = byOrg.get(row.organization_id) ?? [];
    list.push(row);
    byOrg.set(row.organization_id, list);
  }

  const orgs: OrgDeletionPlanItem[] = [];
  const promoteOrgIds: string[] = [];
  const deleteOrgIds: string[] = [];

  for (const orgId of orgIds) {
    const members = byOrg.get(orgId) ?? [];
    const others = members.filter((m) => m.user_id !== targetUserId);
    const item: OrgDeletionPlanItem = {
      id: orgId,
      name: orgNames.get(orgId) ?? "",
      memberCount: members.length,
      action: "none",
    };

    if (others.length === 0) {
      item.action = "delete";
      deleteOrgIds.push(orgId);
    } else if (others.some((m) => m.role === "owner")) {
      item.action = "none";
    } else {
      // admin 优先，其次加入最早（memberRows 已按 created_at 升序）
      const successor = others.find((m) => m.role === "admin") ?? others[0];
      item.action = "promote";
      item.successor = {
        user_id: successor.user_id,
        name: successor.users?.name ?? null,
        email: successor.users?.email ?? null,
        role: successor.role,
      };
      promoteOrgIds.push(orgId);
    }
    orgs.push(item);
  }

  // 为将被删除的组织补充 workspace / 资产计数（预览用）
  if (deleteOrgIds.length > 0) {
    const { data: wsRows, error: wsError } = await admin
      .from("workspace")
      .select("id, organization_id")
      .in("organization_id", deleteOrgIds);

    if (wsError) throw wsError;

    for (const orgId of deleteOrgIds) {
      const wsIds = (wsRows ?? [])
        .filter((w) => w.organization_id === orgId)
        .map((w) => w.id as string);
      const item = orgs.find((o) => o.id === orgId)!;
      item.workspaceCount = wsIds.length;
      item.assetCount =
        wsIds.length === 0
          ? 0
          : (await fetchContainedAssets(admin, wsIds)).length;
    }
  }

  return { orgs, promoteOrgIds, deleteOrgIds };
}

/** 完全包含在给定 workspace 集合内的资产（将被删除的那些）。 */
async function fetchContainedAssets(
  admin: SupabaseClient,
  wsIds: string[],
): Promise<{ id: string; file_url: string | null }[]> {
  const { data, error } = await admin
    .from("asset")
    .select("id, file_url, workspace_id")
    .not("workspace_id", "is", null)
    .containedBy("workspace_id", wsIds);

  if (error) throw error;

  // 与 purge_organizations RPC 的语义保持一致：空数组不算"包含"
  return (data ?? [])
    .filter((a) => Array.isArray(a.workspace_id) && a.workspace_id.length > 0)
    .map((a) => ({ id: a.id as string, file_url: a.file_url as string | null }));
}

/**
 * 计算可以安全删除的存储文件路径：包含资产的 file_url 去重后，
 * 剔除仍被"包含集合之外"的资产引用的（去重共享文件必须保留）。
 */
export async function collectDeletableFilePaths(
  admin: SupabaseClient,
  containedAssets: { id: string; file_url: string | null }[],
): Promise<string[]> {
  const containedIds = new Set(containedAssets.map((a) => a.id));
  const urls = [
    ...new Set(
      containedAssets
        .map((a) => a.file_url)
        .filter((u): u is string => !!u),
    ),
  ];
  if (urls.length === 0) return [];

  const deletable: string[] = [];
  const BATCH = 100;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const { data: refs, error } = await admin
      .from("asset")
      .select("id, file_url")
      .in("file_url", batch);

    if (error) throw error;

    const externallyReferenced = new Set(
      (refs ?? [])
        .filter((r) => !containedIds.has(r.id as string))
        .map((r) => r.file_url as string),
    );
    for (const url of batch) {
      if (externallyReferenced.has(url)) continue;
      try {
        const match = new URL(url).pathname.match(STORAGE_PATH_RE);
        if (match) deletable.push(decodeURIComponent(match[1]));
      } catch {
        // 非法 URL，跳过
      }
    }
  }
  return deletable;
}

export interface PurgeResult {
  deletedAssets: number;
  deletedWorkspaces: number;
  deletedOrgs: number;
  deletedFiles: number;
}

/** 整体删除组织：先清存储文件（失败仅告警，不阻断），再原子删行。 */
export async function purgeOrganizations(
  admin: SupabaseClient,
  orgIds: string[],
): Promise<PurgeResult> {
  if (orgIds.length === 0) {
    return { deletedAssets: 0, deletedWorkspaces: 0, deletedOrgs: 0, deletedFiles: 0 };
  }

  const { data: wsRows, error: wsError } = await admin
    .from("workspace")
    .select("id")
    .in("organization_id", orgIds);

  if (wsError) throw wsError;

  const wsIds = (wsRows ?? []).map((w) => w.id as string);
  let deletedFiles = 0;

  if (wsIds.length > 0) {
    const contained = await fetchContainedAssets(admin, wsIds);
    const paths = await collectDeletableFilePaths(admin, contained);
    const BATCH = 100;
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      const { error: storageError } = await admin.storage
        .from("assets")
        .remove(batch);
      if (storageError) {
        // 与单资产删除一致：存储失败不阻断，残留文件可由 /api/admin/clean 清扫
        console.warn("删除存储文件失败:", storageError);
      } else {
        deletedFiles += batch.length;
      }
    }
  }

  const { data: purged, error: purgeError } = await admin.rpc(
    "purge_organizations",
    { _org_ids: orgIds },
  );

  if (purgeError) throw purgeError;

  const counts = (purged ?? {}) as Record<string, number>;
  return {
    deletedAssets: counts.deleted_assets ?? 0,
    deletedWorkspaces: counts.deleted_workspaces ?? 0,
    deletedOrgs: counts.deleted_orgs ?? 0,
    deletedFiles,
  };
}
