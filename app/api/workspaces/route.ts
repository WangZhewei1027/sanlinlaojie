import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 支持按 organization_id 过滤
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");

    // 使用数据库函数一次性获取所有数据
    const { data, error } = await supabase.rpc("get_user_workspaces", {
      p_user_id: user.id,
    });

    if (error) throw error;

    // 如果指定了 organization_id，则过滤
    const filtered = organizationId
      ? (data || []).filter(
          (w: { organization_id: string }) =>
            w.organization_id === organizationId,
        )
      : data;

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    // 检查用户权限
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

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
      supabase,
      user.id,
      organization_id,
    );
    if (
      !isSuperAdmin(globalRole) &&
      !hasOrgPermission(orgRole, "org.workspaces.create")
    ) {
      await logError(supabase, {
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

    const { data, error } = await supabase
      .from("workspace")
      .insert({
        name,
        description: description || null,
        organization_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建 workspace 失败:", error);
    await logError(supabase, {
      method: "POST",
      path: "/api/workspaces",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "创建工作空间失败" }, { status: 500 });
  }
}
