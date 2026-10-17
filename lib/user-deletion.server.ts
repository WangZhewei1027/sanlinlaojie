import "server-only";
import { db, sql } from "@/lib/db";
import { storagePathFromUrl } from "@/lib/storage-cleanup.server";
import { releaseObjectsIfUnreferenced } from "@/lib/storage/retention.server";

/**
 * 删除用户的服务端编排（仅服务端）。
 *
 * 用户删除只影响身份与维护责任：维护者字段随 users 外键置空，团队文件绝不按
 * OSS 路径删除。只有整组织清除时，组织自有的版本文件、回执和旧行文件才成为
 * 回收候选，并且逐个经过 retention 协议的加锁复核（迁移期默认只报告）。
 *
 * 策略：用户是某组织唯一 owner 时——
 * - 组织还有其他成员 → 晋升最合适的成员为 owner（admin 优先，其次加入最早）；
 * - 只剩他一人 → 连同 workspace、资产、存储文件整体删除该组织。
 *
 * computeUserDeletionPlan 是预览 GET 与 DELETE 的单一事实来源；
 * purgeOrganizations 先调 purge_organizations 函数原子删行，再清理行删除后已无
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
  /** Content model rows removed with the organization (preview only). */
  sceneCount?: number;
  placementCount?: number;
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
  user_name: string | null;
  user_email: string | null;
}

export async function computeUserDeletionPlan(
  targetUserId: string,
): Promise<UserDeletionPlan> {
  const ownerRows = await db
    .selectFrom("organization_member")
    .leftJoin(
      "organization",
      "organization.id",
      "organization_member.organization_id",
    )
    .select(["organization_member.organization_id", "organization.name as org_name"])
    .where("organization_member.user_id", "=", targetUserId)
    .where("organization_member.role", "=", "owner")
    .execute();

  const orgIds = ownerRows.map((r) => r.organization_id);
  if (orgIds.length === 0) {
    return { orgs: [], promoteOrgIds: [], deleteOrgIds: [] };
  }

  const orgNames = new Map<string, string>();
  for (const row of ownerRows) {
    orgNames.set(row.organization_id, row.org_name ?? "");
  }

  const memberRows: MemberRow[] = await db
    .selectFrom("organization_member")
    .leftJoin("users", "users.user_id", "organization_member.user_id")
    .select([
      "organization_member.organization_id",
      "organization_member.user_id",
      "organization_member.role",
      "users.name as user_name",
      "users.email as user_email",
    ])
    .where("organization_member.organization_id", "in", orgIds)
    // 与 promote_owner_successors 的排序保持一致：加入最早优先，同一时刻按 id
    .orderBy("organization_member.created_at", "asc")
    .orderBy("organization_member.id", "asc")
    .execute();

  const byOrg = new Map<string, MemberRow[]>();
  for (const row of memberRows) {
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
        name: successor.user_name,
        email: successor.user_email,
        role: successor.role,
      };
      promoteOrgIds.push(orgId);
    }
    orgs.push(item);
  }

  // 为将被删除的组织补充 workspace / 资产计数（预览用）
  if (deleteOrgIds.length > 0) {
    const wsRows = await db
      .selectFrom("workspace")
      .select(["id", "organization_id"])
      .where("organization_id", "in", deleteOrgIds)
      .execute();

    for (const orgId of deleteOrgIds) {
      const wsIds = wsRows
        .filter((w) => w.organization_id === orgId)
        .map((w) => w.id);
      const item = orgs.find((o) => o.id === orgId)!;
      item.workspaceCount = wsIds.length;
      const legacyAssets = wsIds.length === 0 ? [] : await fetchContainedAssets(wsIds);
      const legacyIds = new Set(legacyAssets.map((a) => a.id));
      const v2Assets = await db.selectFrom("asset").select("id").where("organization_id", "=", orgId).execute();
      item.assetCount = legacyIds.size + v2Assets.filter((a) => !legacyIds.has(a.id)).length;
      const [scenes, placements] = await Promise.all([
        db.selectFrom("scene").select(({ fn }) => fn.countAll<number>().as("n")).where("organization_id", "=", orgId).executeTakeFirstOrThrow(),
        db.selectFrom("placement").select(({ fn }) => fn.countAll<number>().as("n")).where("organization_id", "=", orgId).executeTakeFirstOrThrow(),
      ]);
      item.sceneCount = Number(scenes.n);
      item.placementCount = Number(placements.n);
    }
  }

  return { orgs, promoteOrgIds, deleteOrgIds };
}

/**
 * 完全包含在给定 workspace 集合内的资产（将被删除的那些）。
 * 同时带出 shop 素材的 metadata.checkin_url——打卡图与普通文件共用去重存储。
 */
async function fetchContainedAssets(
  wsIds: string[],
): Promise<{ id: string; file_url: string | null; checkin_url: string | null }[]> {
  if (wsIds.length === 0) return [];

  const rows = await db
    .selectFrom("asset")
    .select([
      "id",
      "file_url",
      "workspace_id",
      sql<string | null>`metadata->>'checkin_url'`.as("checkin_url"),
    ])
    .where("workspace_id", "is not", null)
    .where(sql<boolean>`workspace_id <@ ${wsIds}::uuid[]`)
    .orderBy("id", "asc")
    .execute();

  // 与 purge_organizations 函数的语义保持一致：空数组不算"包含"
  return rows
    .filter((a) => Array.isArray(a.workspace_id) && a.workspace_id.length > 0)
    .map((a) => ({
      id: a.id,
      file_url: a.file_url,
      checkin_url: a.checkin_url,
    }));
}

export interface PurgeResult {
  deletedAssets: number;
  deletedWorkspaces: number;
  deletedOrgs: number;
  deletedFiles: number;
  /** Unreferenced keys left for the collector while object deletion is disabled. */
  deferredFiles: number;
}

/**
 * 整体删除组织：先原子删行（purge_organizations 函数），再删除已无引用的存储文件。
 * 行先删意味着任何失败只会留下孤儿文件（由 /api/admin/clean 全局清扫兜底），
 * 而不会留下指向已删文件的死链行。
 */
export async function purgeOrganizations(orgIds: string[]): Promise<PurgeResult> {
  if (orgIds.length === 0) {
    return { deletedAssets: 0, deletedWorkspaces: 0, deletedOrgs: 0, deletedFiles: 0, deferredFiles: 0 };
  }

  const wsRows = await db
    .selectFrom("workspace")
    .select("id")
    .where("organization_id", "in", orgIds)
    .execute();

  const wsIds = wsRows.map((w) => w.id);

  // 行删除后就查不到这些对象了，先收集候选 key：旧行 file_url + checkin_url、
  // 组织自有版本的资源文件、组织的上传回执。
  const candidateKeys = new Set<string>();
  if (wsIds.length > 0) {
    for (const asset of await fetchContainedAssets(wsIds)) {
      for (const url of [asset.file_url, asset.checkin_url]) {
        const key = url ? storagePathFromUrl(url) : null;
        if (key) candidateKeys.add(key);
      }
    }
  }
  const [resources, receipts] = await Promise.all([
    db
      .selectFrom("asset_version_resource as r")
      .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
      .select("r.storage_key")
      .where("v.organization_id", "in", orgIds)
      .where("r.storage_key", "is not", null)
      .execute(),
    db.selectFrom("upload_receipt").select("storage_key").where("organization_id", "in", orgIds).execute(),
  ]);
  for (const row of resources) if (row.storage_key) candidateKeys.add(row.storage_key);
  for (const row of receipts) candidateKeys.add(row.storage_key);

  const { rows: purgedRows } = await sql<{
    v: Record<string, number> | null;
  }>`select public.purge_organizations(${orgIds}::uuid[]) as v`.execute(db);

  // 行已删完：逐个 key 加锁复核；仍被任一来源（含其他组织）引用的保留。
  const report = await releaseObjectsIfUnreferenced(candidateKeys, { method: "PURGE", path: "purgeOrganizations" });

  const counts = purgedRows[0]?.v ?? {};
  return {
    deletedAssets: counts.deleted_assets ?? 0,
    deletedWorkspaces: counts.deleted_workspaces ?? 0,
    deletedOrgs: counts.deleted_orgs ?? 0,
    deletedFiles: report.removed.length,
    deferredFiles: report.candidates.length,
  };
}
