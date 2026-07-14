import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logErrorSafe } from "@/lib/log-error";
import { computeUserDeletionPlan } from "@/lib/user-deletion.server";

// 删除用户的后果预览（仅 super_admin，只读）：
// 逐组织给出 none / promote（含继任者）/ delete（含 workspace、资产计数），
// 供确认弹窗渲染。被 self / super_admin 规则拦截时返回 blocked 而非报错。
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

    const { data: callerData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (callerData?.role !== "super_admin") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    if (id === user.id) {
      return NextResponse.json({ data: { blocked: "self", orgs: [] } });
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
      return NextResponse.json({ data: { blocked: "super_admin", orgs: [] } });
    }

    const plan = await computeUserDeletionPlan(admin, id);

    return NextResponse.json({ data: { blocked: null, orgs: plan.orgs } });
  } catch (error) {
    console.error("获取删除预览失败:", error);
    await logErrorSafe({
      method: "GET",
      path: "/api/users/[id]/deletion-preview",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "获取删除预览失败" }, { status: 500 });
  }
}
