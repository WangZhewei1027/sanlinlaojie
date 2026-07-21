import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/permissions.server";
import { isSuperAdmin } from "@/lib/permissions";
import { logErrorSafe } from "@/lib/log-error";

// 置顶/取消置顶组织。用户级偏好，写 user_organization_pin（RLS 限定本人行）。
export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId =
      typeof body?.organizationId === "string" ? body.organizationId : null;
    const pinned = typeof body?.pinned === "boolean" ? body.pinned : null;

    if (!organizationId || pinned === null) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // 只能置顶自己可见的组织：本组织成员，或 super_admin（可见全部）
    const { globalRole, orgRole } = await getUserContext(
      supabase,
      user.id,
      organizationId,
    );
    if (!isSuperAdmin(globalRole) && !orgRole) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    if (pinned) {
      // 已置顶时保持原 pinned_at（置顶顺序不变），因此忽略冲突而非更新
      const { error } = await supabase.from("user_organization_pin").upsert(
        { user_id: user.id, organization_id: organizationId },
        { onConflict: "user_id,organization_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_organization_pin")
        .delete()
        .eq("user_id", user.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("组织置顶操作失败:", error);
    await logErrorSafe({
      method: "POST",
      path: "/api/organizations/pin",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
