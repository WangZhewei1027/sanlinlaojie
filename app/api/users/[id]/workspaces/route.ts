import { NextResponse } from "next/server";
import { db, jsonObjectFrom } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext } from "@/lib/permissions.server";
import { isSuperAdmin } from "@/lib/permissions";
import { PROJECT_ASSIGNMENTS_RETIRED } from "@/lib/content-model/projects.server";

// Workspace assignments are history only in the team model: every team
// member reaches every collection through the team role. GET keeps the
// recorded rows for administrators; POST/DELETE are retired (410).

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

// 获取用户的历史 workspace 分配（super_admin 看全部；owner/admin 仅限自己管理的 org）。只读，不授予权限。
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

// 分配已停用：合集没有成员关系，权限只来自团队角色。
async function retired() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未授权" }, { status: 401 });
  return NextResponse.json({ error: PROJECT_ASSIGNMENTS_RETIRED, code: "DEPRECATED" }, { status: 410 });
}

export async function POST() {
  return retired();
}

export async function DELETE() {
  return retired();
}
