import { NextResponse } from "next/server";
import type { Updateable } from "kysely";
import { db, type DB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { logErrorSafe } from "@/lib/log-error";

// PATCH /api/tags/[id] - 更新标签
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 获取当前用户
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const { id: tagId } = await params;

    // 获取标签信息
    const tag = await db
      .selectFrom("tag")
      .select("id")
      .where("id", "=", tagId)
      .executeTakeFirst();

    if (!tag) {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, color } = body;

    // 构建更新对象
    const updates: Updateable<DB["tag"]> = {};
    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (color !== undefined) {
      updates.color = color;
    }

    // 更新标签（没有可更新字段时不下发 UPDATE——空 SET 是非法 SQL——直接回读）
    const updatedTag =
      Object.keys(updates).length > 0
        ? await db
            .updateTable("tag")
            .set(updates)
            .where("id", "=", tagId)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await db
            .selectFrom("tag")
            .selectAll()
            .where("id", "=", tagId)
            .executeTakeFirstOrThrow();

    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    console.error("更新标签失败:", error);
    // 唯一约束冲突（tag_name_workspace_id_key）
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "该工作空间已存在同名标签" },
        { status: 409 }
      );
    }
    await logErrorSafe({
      method: "PATCH",
      path: "/api/tags/[id]",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/tags/[id] - 删除标签
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 获取当前用户
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const { id: tagId } = await params;

    // 获取标签信息
    const tag = await db
      .selectFrom("tag")
      .select("id")
      .where("id", "=", tagId)
      .executeTakeFirst();

    if (!tag) {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }

    // 删除标签
    await db.deleteFrom("tag").where("id", "=", tagId).execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除标签失败:", error);
    await logErrorSafe({
      method: "DELETE",
      path: "/api/tags/[id]",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
