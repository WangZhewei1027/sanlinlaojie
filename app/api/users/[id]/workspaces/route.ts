import { NextResponse } from "next/server";
import { db, jsonObjectFrom } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

/** Orgs where the caller is owner/admin (i.e. can manage workspace assignments). */
async function managedOrgIds(userId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("organization_member")
    .select(["organization_id", "role"])
    .where("user_id", "=", userId)
    .where("role", "in", ["owner", "admin"])
    .execute();
  return rows.map((m) => m.organization_id);
}

// 获取用户的 workspace 分配（super_admin 看全部；owner/admin 仅限自己管理的 org）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { globalRole } = await getUserContext(user.id);
    const superAdmin = isSuperAdmin(globalRole);
    const allowedOrgs = superAdmin ? null : await managedOrgIds(user.id);

    if (!superAdmin && allowedOrgs!.length === 0) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const data = await db
      .selectFrom("workspace_assignment")
      .select((eb) => [
        "workspace_assignment.id",
        "workspace_assignment.workspace_id",
        "workspace_assignment.role",
        "workspace_assignment.created_at",
        jsonObjectFrom(
          eb
            .selectFrom("workspace")
            .select([
              "workspace.id",
              "workspace.name",
              "workspace.description",
              "workspace.organization_id",
            ])
            .whereRef("workspace.id", "=", "workspace_assignment.workspace_id"),
        ).as("workspace"),
      ])
      .where("workspace_assignment.user_id", "=", id)
      .execute();

    // 非 super_admin：仅保留调用者管理的 org 下的分配
    const filtered = superAdmin
      ? data
      : data.filter((row) =>
          row.workspace?.organization_id
            ? allowedOrgs!.includes(row.workspace.organization_id)
            : false,
        );

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("获取用户 workspace 分配失败:", error);
    return NextResponse.json(
      { error: "获取 workspace 分配失败" },
      { status: 500 },
    );
  }
}

// 添加 workspace 分配（需对该 workspace 所属 org 有 org.workspaces.edit，或 super_admin）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, role = "member" } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "缺少 workspace_id" }, { status: 400 });
    }

    const orgId = await getWorkspaceOrgId(workspace_id);
    if (!orgId) {
      return NextResponse.json({ error: "工作空间不存在" }, { status: 404 });
    }

    const { globalRole, orgRole } = await getUserContext(user.id, orgId);
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.edit")
    ) {
      await logError({
        userId: user.id,
        method: "POST",
        path: `/api/users/${id}/workspaces`,
        status: 403,
        message: "权限不足: org.workspaces.edit",
        context: { orgRole, orgId, workspace_id },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // 幂等插入（唯一约束 workspace_assignment(user_id,workspace_id)）；已存在时返回 null
    const data = await db
      .insertInto("workspace_assignment")
      .values({ user_id: id, workspace_id, role })
      .onConflict((oc) => oc.columns(["user_id", "workspace_id"]).doNothing())
      .returningAll()
      .executeTakeFirst();

    return NextResponse.json({ data: data ?? null }, { status: 201 });
  } catch (error) {
    console.error("添加 workspace 分配失败:", error);
    await logError({
      method: "POST",
      path: `/api/users/${id}/workspaces`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "添加 workspace 分配失败" },
      { status: 500 },
    );
  }
}

// 删除 workspace 分配（需对该分配所属 workspace 的 org 有 org.workspaces.edit，或 super_admin）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get("assignment_id");

    if (!assignment_id) {
      return NextResponse.json(
        { error: "缺少 assignment_id" },
        { status: 400 },
      );
    }

    // 解析该分配对应的 workspace → org，再鉴权
    const assignment = await db
      .selectFrom("workspace_assignment")
      .select("workspace_id")
      .where("id", "=", assignment_id)
      .where("user_id", "=", id)
      .executeTakeFirst();

    if (!assignment) {
      return NextResponse.json({ error: "分配不存在" }, { status: 404 });
    }

    const orgId = await getWorkspaceOrgId(assignment.workspace_id);
    const { globalRole, orgRole } = await getUserContext(user.id, orgId);
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.edit")
    ) {
      await logError({
        userId: user.id,
        method: "DELETE",
        path: `/api/users/${id}/workspaces`,
        status: 403,
        message: "权限不足: org.workspaces.edit",
        context: { orgRole, orgId, assignment_id },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    await db
      .deleteFrom("workspace_assignment")
      .where("id", "=", assignment_id)
      .where("user_id", "=", id)
      .execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 workspace 分配失败:", error);
    await logError({
      method: "DELETE",
      path: `/api/users/${id}/workspaces`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "删除 workspace 分配失败" },
      { status: 500 },
    );
  }
}
