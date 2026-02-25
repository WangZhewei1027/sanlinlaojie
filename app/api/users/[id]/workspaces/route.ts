import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 获取用户的 workspace 分配
export async function GET(
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
          description
        )
      `,
      )
      .eq("user_id", id);

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取用户 workspace 分配失败:", error);
    return NextResponse.json(
      { error: "获取 workspace 分配失败" },
      { status: 500 },
    );
  }
}

// 添加 workspace 分配
export async function POST(
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
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { workspace_id, role = "member" } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "缺少 workspace_id" }, { status: 400 });
    }

    // 检查是否已经分配
    const { data: existing } = await supabase
      .from("workspace_assignment")
      .select("id")
      .eq("user_id", id)
      .eq("workspace_id", workspace_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "该用户已经被分配到此工作空间" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("workspace_assignment")
      .insert({
        user_id: id,
        workspace_id,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("添加 workspace 分配失败:", error);
    return NextResponse.json(
      { error: "添加 workspace 分配失败" },
      { status: 500 },
    );
  }
}

// 删除 workspace 分配
export async function DELETE(
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
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get("assignment_id");

    if (!assignment_id) {
      return NextResponse.json(
        { error: "缺少 assignment_id" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "删除 workspace 分配失败" },
      { status: 500 },
    );
  }
}
