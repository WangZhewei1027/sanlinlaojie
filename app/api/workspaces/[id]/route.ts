import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin, type OrgPermission } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const data = await db
      .selectFrom("workspace")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

/**
 * Gate a workspace mutation: the caller must be super_admin, or hold the given
 * org permission in the workspace's organization. Returns the resolved orgId
 * on success, or a NextResponse (401/403/404) to short-circuit.
 */
async function authorizeWorkspaceMutation(
  workspaceId: string,
  permission: OrgPermission,
  method: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const user = await getSessionUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未授权" }, { status: 401 }),
    };
  }

  const orgId = await getWorkspaceOrgId(workspaceId);
  if (!orgId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "工作空间不存在" }, { status: 404 }),
    };
  }

  const { globalRole, orgRole } = await getUserContext(user.id, orgId);
  if (!isSuperAdmin(globalRole) && !hasOrgPermission(orgRole, permission)) {
    await logError({
      userId: user.id,
      method,
      path: `/api/workspaces/${workspaceId}`,
      status: 403,
      message: `权限不足: ${permission}`,
      context: { orgRole, orgId },
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "权限不足" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const auth = await authorizeWorkspaceMutation(
      id,
      "org.workspaces.edit",
      "PUT",
    );
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const data = await db
      .updateTable("workspace")
      .set({
        name,
        description: description || null,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新 workspace 失败:", error);
    await logError({
      method: "PUT",
      path: `/api/workspaces/${id}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "更新工作空间失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const auth = await authorizeWorkspaceMutation(
      id,
      "org.workspaces.delete",
      "DELETE",
    );
    if (!auth.ok) return auth.response;

    // 检查是否有关联的资产
    // 使用 @> 运算符检查 workspace_id 数组是否包含当前 workspace
    const { count } = await db
      .selectFrom("asset")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where(sql<boolean>`workspace_id @> array[${id}::uuid]`)
      .executeTakeFirstOrThrow();

    if (count > 0) {
      return NextResponse.json(
        { error: `无法删除：该工作空间包含 ${count} 个资产` },
        { status: 400 },
      );
    }

    await db.deleteFrom("workspace").where("id", "=", id).execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 workspace 失败:", error);
    await logError({
      method: "DELETE",
      path: `/api/workspaces/${id}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "删除工作空间失败" }, { status: 500 });
  }
}
