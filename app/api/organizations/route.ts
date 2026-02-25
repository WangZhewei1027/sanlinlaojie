import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 获取用户可访问的所有 organization
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("get_user_organizations", {
      p_user_id: user.id,
    });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 organization 失败:", error);
    return NextResponse.json({ error: "获取组织失败" }, { status: 500 });
  }
}

// 创建新的 organization（仅 admin）
export async function POST(request: Request) {
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
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    // 创建 organization
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .insert({
        name,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 将创建者设为 owner
    const { error: memberError } = await supabase
      .from("organization_member")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    return NextResponse.json({ data: org }, { status: 201 });
  } catch (error) {
    console.error("创建 organization 失败:", error);
    return NextResponse.json({ error: "创建组织失败" }, { status: 500 });
  }
}
