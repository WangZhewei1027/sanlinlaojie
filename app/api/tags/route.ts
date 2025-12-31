import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/tags?workspace_id=xxx - 获取工作空间的所有标签
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 从URL获取workspace_id
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "缺少workspace_id参数" },
        { status: 400 }
      );
    }

    // 获取该工作空间的所有标签
    const { data: tags, error } = await supabase
      .from("tag")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });

    if (error) {
      console.error("获取标签失败:", error);
      return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
    }

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("获取标签失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/tags - 创建新标签
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, color, workspace_id } = body;

    if (!name || !workspace_id) {
      return NextResponse.json({ error: "缺少必需参数" }, { status: 400 });
    }

    // 创建标签
    const { data: tag, error } = await supabase
      .from("tag")
      .insert({
        name: name.trim(),
        color: color || "#808080",
        workspace_id,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("创建标签失败:", error);
      // 检查是否是唯一约束冲突
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "该工作空间已存在同名标签" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "创建标签失败" }, { status: 500 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("创建标签失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
