import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Orgs where the caller is owner/admin (i.e. can manage workspace assignments). */
async function managedOrgIds(supabase: Supa, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("organization_member")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);
  return (data ?? []).map((m) => m.organization_id as string);
}

// 获取用户的 workspace 分配（super_admin 看全部；owner/admin 仅限自己管理的 org）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { globalRole } = await getUserContext(supabase, user.id);
    const superAdmin = isSuperAdmin(globalRole);
    const allowedOrgs = superAdmin ? null : await managedOrgIds(supabase, user.id);

    if (!superAdmin && allowedOrgs!.length === 0) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("workspace_assignment")
      .select(
        `
        id,
        workspace_id,
        role,
        created_at,
        workspace (
          id,
          name,
          description,
          organization_id
        )
      `,
      )
      .eq("user_id", id);

    if (error) throw error;

    // 非 super_admin：仅保留调用者管理的 org 下的分配
    const filtered = superAdmin
      ? data
      : (data ?? []).filter((row) => {
          const ws = row.workspace as { organization_id?: string } | null;
          return ws?.organization_id
            ? allowedOrgs!.includes(ws.organization_id)
            : false;
        });

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
  const supabase = await createClient();
  const { id } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, role = "member" } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "缺少 workspace_id" }, { status: 400 });
    }

    const orgId = await getWorkspaceOrgId(supabase, workspace_id);
    if (!orgId) {
      return NextResponse.json({ error: "工作空间不存在" }, { status: 404 });
    }

    const { globalRole, orgRole } = await getUserContext(supabase, user.id, orgId);
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.edit")
    ) {
      await logError(supabase, {
        userId: user.id,
        method: "POST",
        path: `/api/users/${id}/workspaces`,
        status: 403,
        message: "权限不足: org.workspaces.edit",
        context: { orgRole, orgId, workspace_id },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // 幂等插入（唯一约束 workspace_assignment(workspace_id,user_id)）
    const { data, error } = await supabase
      .from("workspace_assignment")
      .upsert(
        { user_id: id, workspace_id, role },
        { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("添加 workspace 分配失败:", error);
    await logError(supabase, {
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
  const supabase = await createClient();
  const { id } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const { data: assignment } = await supabase
      .from("workspace_assignment")
      .select("workspace_id")
      .eq("id", assignment_id)
      .eq("user_id", id)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "分配不存在" }, { status: 404 });
    }

    const orgId = await getWorkspaceOrgId(supabase, assignment.workspace_id);
    const { globalRole, orgRole } = await getUserContext(supabase, user.id, orgId);
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.edit")
    ) {
      await logError(supabase, {
        userId: user.id,
        method: "DELETE",
        path: `/api/users/${id}/workspaces`,
        status: 403,
        message: "权限不足: org.workspaces.edit",
        context: { orgRole, orgId, assignment_id },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { error } = await supabase
      .from("workspace_assignment")
      .delete()
      .eq("id", assignment_id)
      .eq("user_id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 workspace 分配失败:", error);
    await logError(supabase, {
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
