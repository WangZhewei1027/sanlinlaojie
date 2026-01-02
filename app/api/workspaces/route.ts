import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取用户角色
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userError) throw userError;

    // 如果是 admin，返回所有 workspace
    if (userData?.role === "admin") {
      const { data, error } = await supabase
        .from("workspace")
        .select("id, name, description, create_date")
        .order("create_date", { ascending: false });

      if (error) throw error;

      return NextResponse.json({ data });
    }

    // 如果是其他角色，返回用户被分配的 workspace
    const { data, error } = await supabase
      .from("workspace_assignment")
      .select(
        `
        workspace_id,
        workspace:workspace_id (
          id,
          name,
          description,
          create_date
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 提取 workspace 数据
    const workspaces =
      data?.map((item) => item.workspace).filter(Boolean) || [];

    return NextResponse.json({ data: workspaces });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 检查用户权限
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("workspace")
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("创建 workspace 失败:", error);
    return NextResponse.json({ error: "创建工作空间失败" }, { status: 500 });
  }
}
