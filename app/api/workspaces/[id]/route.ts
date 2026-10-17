import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin, type OrgPermission } from "@/lib/permissions";
import { logError } from "@/lib/log-error";
import { loadActor, requireWorkspaceRead } from "@/lib/content-model/access.server";
import { failure, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { ContentError } from "@/lib/content-model/errors";

/** Project row plus the caller's effective role and capabilities (read access required). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    if (!isUuid(id)) throw new ContentError("NOT_FOUND", "项目不存在");
    const access = await requireWorkspaceRead(db, await loadActor(db, userId), id);
    const data = await db.selectFrom("workspace").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    return NextResponse.json({
      data: {
        ...data,
        project_role: access.projectRole,
        content_model_state: access.org.content_model_state,
        capabilities: access.capabilities,
      },
    });
  } catch (error) {
    return failure(error, { method: "GET", path: `/api/workspaces/${id}`, userId });
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

    // 只有完全空的项目可以硬删除；有任何内容（旧资产行、素材授权、场景、投放、
    // 旧多项目入口）时默认归档（POST /api/workspaces/[id]/archive），不级联吞掉依赖。
    const { rows } = await sql<{ assets: number; grants: number; scenes: number; placements: number; scopes: number }>`
      select
        (select count(*) from asset where workspace_id @> array[${id}::uuid] or origin_workspace_id = ${id}::uuid) as assets,
        (select count(*) from asset_workspace_grant where workspace_id = ${id}::uuid) as grants,
        (select count(*) from scene where workspace_id = ${id}::uuid) as scenes,
        (select count(*) from placement where workspace_id = ${id}::uuid) as placements,
        (select count(*) from legacy_content_map where workspace_id = ${id}::uuid) as scopes
    `.execute(db);
    const counts = rows[0];
    const total = counts ? Object.values(counts).reduce((sum, n) => sum + Number(n), 0) : 0;
    if (total > 0) {
      return NextResponse.json(
        {
          error: `无法删除：该工作空间仍有内容（资产 ${counts.assets}、授权 ${counts.grants}、场景 ${counts.scenes}、投放 ${counts.placements}、旧入口 ${counts.scopes}），请改为归档`,
          code: "DEPENDENCY_CONFLICT",
        },
        { status: 409 },
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
