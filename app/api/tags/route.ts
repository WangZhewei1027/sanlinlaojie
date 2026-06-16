import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/tags?workspace_id=xxx - 获取工作空间的所有标签
// GET /api/tags?organization_id=xxx - 获取该组织下所有 workspace 的标签（"All workspaces" 视图）
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

    // 从URL获取workspace_id 或 organization_id
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");
    const organizationId = searchParams.get("organization_id");

    if (!workspaceId && !organizationId) {
      return NextResponse.json(
        { error: "缺少workspace_id或organization_id参数" },
        { status: 400 }
      );
    }

    // 组织级：先查出该组织下所有 workspace IDs，再按这些 workspace 取标签
    let workspaceIds: string[] | null = null;
    if (!workspaceId && organizationId) {
      const { data: workspaceRows, error: wsError } = await supabase
        .from("workspace")
        .select("id")
        .eq("organization_id", organizationId);

      if (wsError) {
        console.error("查询 workspaces 失败:", wsError);
        return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
      }

      workspaceIds = (workspaceRows ?? []).map((w) => w.id);
      if (workspaceIds.length === 0) {
        return NextResponse.json({ tags: [] });
      }
    }

    // 获取标签
    let query = supabase.from("tag").select("*");
    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    } else if (workspaceIds) {
      query = query.in("workspace_id", workspaceIds);
    }
    query = query.order("name", { ascending: true });

    const { data: tags, error } = await query;

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
