import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from("workspace")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 workspace 失败:", error);
    return NextResponse.json({ error: "获取工作空间失败" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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
      .update({
        name,
        description: description || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新 workspace 失败:", error);
    return NextResponse.json({ error: "更新工作空间失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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

    // 检查是否有关联的资产
    // 使用 @> 运算符检查 workspace_id 数组是否包含当前 workspace
    const { count } = await supabase
      .from("asset")
      .select("*", { count: "exact", head: true })
      .contains("workspace_id", [id]);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `无法删除：该工作空间包含 ${count} 个资产` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("workspace").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 workspace 失败:", error);
    return NextResponse.json({ error: "删除工作空间失败" }, { status: 500 });
  }
}
