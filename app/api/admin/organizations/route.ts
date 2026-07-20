import { createClient } from "@/lib/supabase/server";
import { NextResponse, connection } from "next/server";
import { logErrorSafe } from "@/lib/log-error";

// GET all organizations with members (super_admin only)
export async function GET() {
  // 会话依赖 cookies()，必须请求时渲染。connection() 要放在 try 之外：
  // build 预渲染的退出信号若被 catch 截获，会误写一条 500 错误日志
  await connection();
  try {
    const supabase = await createClient();

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
        method: "GET",
        path: "/api/admin/organizations",
        status: 403,
        message: "权限不足: 仅 super_admin",
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("organization")
      .select(
        `
        id,
        name,
        description,
        created_at,
        created_by,
        map_center,
        allowed_file_types,
        config,
        organization_member (
          id,
          role,
          user_id,
          users (
            user_id,
            name,
            email
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取所有组织失败:", error);
    await logErrorSafe({
      method: "GET",
      path: "/api/admin/organizations",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "获取组织失败" }, { status: 500 });
  }
}
