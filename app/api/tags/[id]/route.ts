import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/tags/[id] - 更新标签
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: tagId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取标签信息
    const { data: tag, error: fetchError } = await supabase
      .from("tag")
      .select("*, workspace_id")
      .eq("id", tagId)
      .single();

    if (fetchError || !tag) {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }

    // 检查用户是否有权限修改此标签（需要在该工作空间中）
    const { data: assignment } = await supabase
      .from("workspace_assignment")
      .select("id")
      .eq("workspace_id", tag.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "无权限修改此标签" }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, color } = body;

    // 构建更新对象
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (color !== undefined) {
      updates.color = color;
    }

    // 更新标签
    const { data: updatedTag, error: updateError } = await supabase
      .from("tag")
      .update(updates)
      .eq("id", tagId)
      .select("*")
      .single();

    if (updateError) {
      console.error("更新标签失败:", updateError);
      // 检查是否是唯一约束冲突
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "该工作空间已存在同名标签" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "更新标签失败" }, { status: 500 });
    }

    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    console.error("更新标签失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/tags/[id] - 删除标签
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: tagId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取标签信息
    const { data: tag, error: fetchError } = await supabase
      .from("tag")
      .select("workspace_id")
      .eq("id", tagId)
      .single();

    if (fetchError || !tag) {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }

    // 检查用户是否有权限删除此标签（需要在该工作空间中）
    const { data: assignment } = await supabase
      .from("workspace_assignment")
      .select("id")
      .eq("workspace_id", tag.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "无权限删除此标签" }, { status: 403 });
    }

    // 删除标签
    const { error: deleteError } = await supabase
      .from("tag")
      .delete()
      .eq("id", tagId);

    if (deleteError) {
      console.error("删除标签失败:", deleteError);
      return NextResponse.json({ error: "删除标签失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除标签失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
