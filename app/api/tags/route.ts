import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { logErrorSafe } from "@/lib/log-error";

// GET /api/tags?workspace_id=xxx - 获取工作空间的所有标签
// GET /api/tags?organization_id=xxx - 获取该组织下所有 workspace 的标签（"All workspaces" 视图）
export async function GET(request: Request) {
  // 获取当前用户
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
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
      const workspaceRows = await db
        .selectFrom("workspace")
        .select("id")
        .where("organization_id", "=", organizationId)
        .execute();

      workspaceIds = workspaceRows.map((w) => w.id);
      if (workspaceIds.length === 0) {
        return NextResponse.json({ tags: [] });
      }
    }

    // 获取标签
    let query = db.selectFrom("tag").selectAll();
    if (workspaceId) {
      query = query.where("workspace_id", "=", workspaceId);
    } else if (workspaceIds) {
      query = query.where("workspace_id", "in", workspaceIds);
    }
    query = query.orderBy("name", "asc");

    const tags = await query.execute();

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("获取标签失败:", error);
    await logErrorSafe({
      method: "GET",
      path: "/api/tags",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/tags - 创建新标签
export async function POST(request: Request) {
  // 获取当前用户
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    // 解析请求体
    const body = await request.json();
    const { name, color, workspace_id } = body;

    if (!name || !workspace_id) {
      return NextResponse.json({ error: "缺少必需参数" }, { status: 400 });
    }

    // 创建标签
    const tag = await db
      .insertInto("tag")
      .values({
        name: name.trim(),
        color: color || "#808080",
        workspace_id,
        created_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return NextResponse.json({ tag });
  } catch (error) {
    console.error("创建标签失败:", error);
    // 唯一约束冲突（tag_name_workspace_id_key）
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "该工作空间已存在同名标签" },
        { status: 409 }
      );
    }
    await logErrorSafe({
      method: "POST",
      path: "/api/tags",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
