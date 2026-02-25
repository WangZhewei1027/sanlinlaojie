import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 获取单个 organization 详情
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

    const { data, error } = await supabase
      .from("organization")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 organization 失败:", error);
    return NextResponse.json({ error: "获取组织失败" }, { status: 500 });
  }
}

// 更新 organization（仅 admin/owner）
export async function PUT(
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

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    // super_admin can always update; otherwise check org role
    if (userData?.role !== "super_admin") {
      const { data: membership } = await supabase
        .from("organization_member")
        .select("role")
        .eq("organization_id", id)
        .eq("user_id", user.id)
        .single();

      if (membership?.role !== "owner") {
        return NextResponse.json({ error: "权限不足" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, description } = body;

    const { data, error } = await supabase
      .from("organization")
      .update({ name, description })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新 organization 失败:", error);
    return NextResponse.json({ error: "更新组织失败" }, { status: 500 });
  }
}

// 删除 organization（仅 admin/owner，且无 workspace 时）
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

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    // super_admin can always delete; otherwise check org role
    if (userData?.role !== "super_admin") {
      const { data: membership } = await supabase
        .from("organization_member")
        .select("role")
        .eq("organization_id", id)
        .eq("user_id", user.id)
        .single();

      if (membership?.role !== "owner") {
        return NextResponse.json({ error: "权限不足" }, { status: 403 });
      }
    }

    // 检查是否有关联的 workspace
    const { data: workspaces } = await supabase
      .from("workspace")
      .select("id")
      .eq("organization_id", id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      return NextResponse.json(
        { error: "该组织下还有工作空间，请先删除所有工作空间" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("organization").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 organization 失败:", error);
    return NextResponse.json({ error: "删除组织失败" }, { status: 500 });
  }
}
