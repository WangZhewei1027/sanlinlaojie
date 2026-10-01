import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { isSuperAdmin } from "@/lib/permissions";

/**
 * 按内容 hash 查已存在的文件 URL，用于上传前去重。
 * 去重按组织隔离：必须携带目标 workspace_id，服务端解析其所属组织，
 * 只匹配同组织 workspace 下的资产——避免跨组织共享存储对象
 * （否则删除 A 组织的资产可能清掉 B 组织仍在引用的文件）。
 * 命中则复用返回的 file_url、跳过重复存储上传；未命中返回 { file_url: null }。
 */
export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");
  const workspaceId = searchParams.get("workspace_id");

  if (!hash) {
    return NextResponse.json({ error: "缺少 hash" }, { status: 400 });
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "缺少 workspace_id" }, { status: 400 });
  }

  // 解析目标 workspace 所属组织；不存在则拒绝
  const orgId = await getWorkspaceOrgId(workspaceId);
  if (!orgId) {
    return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
  }

  // 鉴权：super_admin 放行；否则必须是该组织成员
  const { globalRole, orgRole } = await getUserContext(user.id, orgId);
  if (!isSuperAdmin(globalRole ?? undefined) && !orgRole) {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  try {
    // 组织内去重：只匹配 workspace_id 与本组织 workspace 集合有交集的资产
    const wsRows = await db
      .selectFrom("workspace")
      .select("id")
      .where("organization_id", "=", orgId)
      .execute();

    const orgWorkspaceIds = wsRows.map((w) => w.id);
    if (orgWorkspaceIds.length === 0) {
      return NextResponse.json({ file_url: null });
    }

    const data = await db
      .selectFrom("asset")
      .select("file_url")
      .where("content_hash", "=", hash)
      .where("file_url", "is not", null)
      .where("workspace_id", "&&", orgWorkspaceIds)
      .limit(1)
      .executeTakeFirst();

    return NextResponse.json({ file_url: data?.file_url ?? null });
  } catch (error) {
    console.error("by-hash 查询失败:", error);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
