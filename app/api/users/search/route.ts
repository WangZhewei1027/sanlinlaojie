import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

// org 范围内的用户搜索（供成员页邀请/添加）。
// 必须带 organization_id 且调用者对该 org 有 org.members.add；查询用邮箱精确
// 或 name/email ≥3 字符前缀（非全表模糊），降低用户枚举面。
export async function GET(request: Request) {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");
    const q = (searchParams.get("q") ?? "").trim();

    if (!organizationId) {
      return NextResponse.json(
        { error: "缺少 organization_id" },
        { status: 400 },
      );
    }

    const { globalRole, orgRole } = await getUserContext(
      supabase,
      user.id,
      organizationId,
    );
    if (!isSuperAdmin(globalRole) && !hasOrgPermission(orgRole, "org.members.add")) {
      await logError(supabase, {
        userId: user.id,
        method: "GET",
        path: "/api/users/search",
        status: 403,
        message: "权限不足: org.members.add",
        context: { orgRole, organizationId },
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // 精确邮箱 或 ≥3 字符前缀；否则返回空，避免枚举
    let query = supabase.from("users").select("user_id, name, email").limit(20);

    if (q.includes("@")) {
      query = query.eq("email", q);
    } else if (q.length >= 3) {
      const prefix = q.replace(/[%_]/g, "\\$&");
      query = query.or(`name.ilike.${prefix}%,email.ilike.${prefix}%`);
    } else {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("搜索用户失败:", error);
    await logError(supabase, {
      method: "GET",
      path: "/api/users/search",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "搜索用户失败" }, { status: 500 });
  }
}
