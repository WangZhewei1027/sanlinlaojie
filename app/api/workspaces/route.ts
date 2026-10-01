import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

/** public.get_user_workspaces(p_user_id) 的返回行 */
interface UserWorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  create_date: Date | null;
  organization_id: string;
}

export async function GET(request: Request) {
  // 获取当前用户
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    // 支持按 organization_id 过滤
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");

    // super_admin 可查看任意组织的 workspace（get_user_workspaces 按成员关系
    // 过滤，会漏掉 super_admin 未加入的组织——资源清理等全局管理页面需要全量）
    const userData = await db
      .selectFrom("users")
      .select("role")
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (isSuperAdmin(userData?.role)) {
      let query = db.selectFrom("workspace").selectAll();
      if (organizationId) {
        query = query.where("organization_id", "=", organizationId);
      }
      const allWorkspaces = await query.execute();
      return NextResponse.json({ data: allWorkspaces });
    }

    // 使用数据库函数一次性获取所有数据
    const { rows: data } = await sql<UserWorkspaceRow>`
      select * from public.get_user_workspaces(${user.id}::uuid)
    `.execute(db);

    // 如果指定了 organization_id，则过滤
    const filtered = organizationId
      ? data.filter((w) => w.organization_id === organizationId)
      : data;

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 检查用户权限
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, organization_id } = body;

    if (!organization_id) {
      return NextResponse.json(
        { error: "缺少 organization_id" },
        { status: 400 },
      );
    }

    // 需 org.workspaces.create（owner/admin）或 super_admin
    const { globalRole, orgRole } = await getUserContext(
      user.id,
      organization_id,
    );
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.create")
    ) {
      await logError({
        userId: user.id,
        method: "POST",
        path: "/api/workspaces",
        status: 403,
        message: "权限不足: org.workspaces.create",
        context: { orgRole, organization_id },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const data = await db
      .insertInto("workspace")
      .values({
        name,
        description: description || null,
        organization_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建 workspace 失败:", error);
    await logError({
      method: "POST",
      path: "/api/workspaces",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "创建工作空间失败" }, { status: 500 });
  }
}
