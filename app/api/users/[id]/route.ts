import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !["admin", "student"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 });
    }

    // 不能修改自己的角色
    if (id === user.id) {
      return NextResponse.json(
        { error: "不能修改自己的角色" },
        { status: 400 }
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
    return NextResponse.json({ error: "更新用户角色失败" }, { status: 500 });
  }
}
