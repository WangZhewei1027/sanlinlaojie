import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { logError } from "@/lib/log-error";
import { storagePathFromUrl } from "@/lib/storage-cleanup.server";

/**
 * 删除用户的服务端编排（仅服务端，配合 service-role admin client 使用）。
 *
 * 策略：用户是某组织唯一 owner 时——
 * - 组织还有其他成员 → 晋升最合适的成员为 owner（admin 优先，其次加入最早）；
 * - 只剩他一人 → 连同 workspace、资产、存储文件整体删除该组织。
 *
 * computeUserDeletionPlan 是预览 GET 与 DELETE 的单一事实来源；
 * purgeOrganizations 先调 purge_organizations RPC 原子删行，再清理行删除后已无
 * 任何引用的存储文件（内容 hash 去重会让多个资产跨组织共享同一文件，行删完后
 * 仍被引用的 URL 一律保留）。失败方向只留孤儿文件，由 /api/admin/clean 全局
 * 清扫兜底，不会出现死链。
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

interface ContainedAssetRow {
  id: string;
  file_url: string | null;
  checkin_url: string | null;
  workspace_id: string[] | null;
}

/**
 * 完全包含在给定 workspace 集合内的资产（将被删除的那些）。
 * 分页拉全量，避免 PostgREST 1000 行截断漏掉资产。
 * 同时带出 shop 素材的 metadata.checkin_url——打卡图与普通文件共用去重存储。
 */
async function fetchContainedAssets(
  admin: SupabaseClient,
  wsIds: string[],
): Promise<{ id: string; file_url: string | null; checkin_url: string | null }[]> {
  const { data, error } = await fetchAllRows<ContainedAssetRow>(() =>
    admin
      .from("asset")
      .select("id, file_url, checkin_url:metadata->>checkin_url, workspace_id")
      .not("workspace_id", "is", null)
      .containedBy("workspace_id", wsIds)
      .order("id", { ascending: true }),
  );

  if (error) throw error;

  // 与 purge_organizations RPC 的语义保持一致：空数组不算"包含"
  return (data ?? [])
    .filter((a) => Array.isArray(a.workspace_id) && a.workspace_id.length > 0)
    .map((a) => ({
      id: a.id,
      file_url: a.file_url,
      checkin_url: a.checkin_url,
    }));
}

/**
 * 行删除之后，查这批 URL 里仍被剩余资产（file_url 或 metadata.checkin_url）
 * 引用的子集——它们属于外部组织的共享文件，必须保留。
 * 每批 100 个 URL，且分页拉全量，杜绝 1000 行截断漏判外部引用。
 */
async function findStillReferencedUrls(
  admin: SupabaseClient,
  urls: string[],
): Promise<Set<string>> {
  const referenced = new Set<string>();
  const BATCH = 100;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);

    const byFileUrl = await fetchAllRows<{ file_url: string | null }>(() =>
      admin
        .from("asset")
        .select("file_url")
        .in("file_url", batch)
        .order("id", { ascending: true }),
    );
    if (byFileUrl.error) throw byFileUrl.error;
    for (const row of byFileUrl.data) {
      if (row.file_url) referenced.add(row.file_url);
    }

    const byCheckinUrl = await fetchAllRows<{ checkin_url: string | null }>(() =>
      admin
        .from("asset")
        .select("checkin_url:metadata->>checkin_url")
        .in("metadata->>checkin_url", batch)
        .order("id", { ascending: true }),
    );
    if (byCheckinUrl.error) throw byCheckinUrl.error;
    for (const row of byCheckinUrl.data) {
      if (row.checkin_url) referenced.add(row.checkin_url);
    }
  }
  return referenced;
}

export interface PurgeResult {
  deletedAssets: number;
  deletedWorkspaces: number;
  deletedOrgs: number;
  deletedFiles: number;
}

/**
 * 整体删除组织：先原子删行（RPC），再删除已无引用的存储文件。
 * 行先删意味着任何失败只会留下孤儿文件（由 /api/admin/clean 全局清扫兜底），
 * 而不会留下指向已删文件的死链行。
 */
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

  // 行删除后就查不到这些资产了，先收集候选文件 URL（file_url + checkin_url）
  let candidateUrls: string[] = [];
  if (wsIds.length > 0) {
    const contained = await fetchContainedAssets(admin, wsIds);
    candidateUrls = [
      ...new Set(
        contained
          .flatMap((a) => [a.file_url, a.checkin_url])
          .filter((u): u is string => !!u),
      ),
    ];
  }

  const { data: purged, error: purgeError } = await admin.rpc(
    "purge_organizations",
    { _org_ids: orgIds },
  );

  if (purgeError) throw purgeError;

  // 行已删完：候选 URL 里仍被引用的属于外部组织的共享文件，保留；其余删除
  let deletedFiles = 0;
  if (candidateUrls.length > 0) {
    const referenced = await findStillReferencedUrls(admin, candidateUrls);
    const paths = candidateUrls
      .filter((u) => !referenced.has(u))
      .map(storagePathFromUrl)
      .filter((p): p is string => !!p);

    const BATCH = 100;
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      const { error: storageError } = await admin.storage
        .from("assets")
        .remove(batch);
      if (storageError) {
        // 存储失败不阻断：孤儿文件由 /api/admin/clean 全局清扫兜底
        console.warn("删除存储文件失败:", storageError);
        await logError(admin, {
          method: "PURGE",
          path: "purgeOrganizations",
          status: 500,
          message: `storage remove failed: ${storageError.message}`,
          context: { batch: batch.slice(0, 20), orgIds },
        });
      } else {
        deletedFiles += batch.length;
      }
    }
  }

  const counts = (purged ?? {}) as Record<string, number>;
  return {
    deletedAssets: counts.deleted_assets ?? 0,
    deletedWorkspaces: counts.deleted_workspaces ?? 0,
    deletedOrgs: counts.deleted_orgs ?? 0,
    deletedFiles,
  };
}
