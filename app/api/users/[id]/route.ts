import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logErrorSafe } from "@/lib/log-error";
import {
  computeUserDeletionPlan,
  purgeOrganizations,
} from "@/lib/user-deletion.server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 检查权限
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userData?.role !== "super_admin") {
      await logErrorSafe({
        userId: user.id,
        method: "PUT",
        path: `/api/users/${id}`,
        status: 403,
        message: "权限不足: 仅 super_admin 可改用户角色",
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["super_admin", "user"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 });
    }

    // 不能修改自己的角色
    if (id === user.id) {
      return NextResponse.json(
        { error: "不能修改自己的角色" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .eq("user_id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新用户角色失败:", error);
    await logErrorSafe({
      method: "PUT",
      path: "/api/users/[id]",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "更新用户角色失败" }, { status: 500 });
  }
}

// 删除用户（仅 super_admin）。对他是唯一 owner 的组织：
// 有其他成员 → 晋升继任者；只剩他一人 → 连同 workspace/资产/存储文件删除组织。
// 执行顺序保证任一步失败后系统仍可恢复、整个接口可重试：
// 先晋升 → 再清空组织 → 最后删 auth 用户（外键级联收尾）。
export async function DELETE(
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

    const { data: callerData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (callerData?.role !== "super_admin") {
      await logErrorSafe({
        userId: user.id,
        method: "DELETE",
        path: `/api/users/${id}`,
        status: 403,
        message: "权限不足: 仅 super_admin 可删除用户",
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    if (id === user.id) {
      return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: target } = await admin
      .from("users")
      .select("role")
      .eq("user_id", id)
      .single();

    if (!target) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (target.role === "super_admin") {
      return NextResponse.json(
        { error: "不能删除超级管理员，请先将其降级" },
        { status: 400 },
      );
    }

    const plan = await computeUserDeletionPlan(admin, id);

    if (plan.promoteOrgIds.length > 0) {
      const { error: promoteError } = await admin.rpc(
        "promote_owner_successors",
        { _org_ids: plan.promoteOrgIds, _excluding_user: id },
      );
      if (promoteError) throw promoteError;
    }

    const purge = await purgeOrganizations(admin, plan.deleteOrgIds);

    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    return NextResponse.json({
      success: true,
      summary: {
        promotedOrgIds: plan.promoteOrgIds,
        deletedOrgIds: plan.deleteOrgIds,
        deletedAssets: purge.deletedAssets,
        deletedFiles: purge.deletedFiles,
      },
    });
  } catch (error) {
    console.error("删除用户失败:", error);
    await logErrorSafe({
      method: "DELETE",
      path: "/api/users/[id]",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
