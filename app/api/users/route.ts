import { createClient } from "@/lib/supabase/server";
import { NextResponse, connection } from "next/server";

export async function GET() {
  await connection();
  try {
    const supabase = await createClient();

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
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // 获取所有用户及其 workspace 分配情况
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        user_id,
        name,
        email,
        role,
        created_at,
        workspace_assignment (
          id,
          workspace_id,
          role,
          created_at,
          workspace (
            id,
            name
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}
