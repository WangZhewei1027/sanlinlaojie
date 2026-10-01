import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { logErrorSafe } from "@/lib/log-error";

// 获取 organization 下所有 workspace 的 assets（用于 "All workspaces" 视图）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: organizationId } = await params;

    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 解析查询参数（与 /api/workspaces/[id]/assets 保持一致）
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const requireLocation = searchParams.get("requireLocation") === "true";

    // 先查出该 organization 下的所有 workspace IDs
    const workspaceRows = await db
      .selectFrom("workspace")
      .select("id")
      .where("organization_id", "=", organizationId)
      .execute();

    const workspaceIds = workspaceRows.map((w) => w.id);

    if (workspaceIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // asset.workspace_id 是数组，用 && 判断是否与本组织的任一 workspace 相交。
    // 直连 Postgres 无行数上限，一次拉全量（派生的 file_type 选项与列表都依赖完整集合）。
    let query = db
      .selectFrom("asset")
      .selectAll()
      .where("workspace_id", "&&", workspaceIds);

    if (type) {
      query = query.where("file_type", "=", type);
    }

    if (requireLocation) {
      query = query.where("location", "is not", null);
    }

    const data = await query.execute();

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 organization assets 失败:", error);
    await logErrorSafe({
      method: "GET",
      path: "/api/organizations/[id]/assets",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
