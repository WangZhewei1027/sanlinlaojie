import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { NextResponse } from "next/server";

// 获取 organization 下所有 workspace 的 assets（用于 "All workspaces" 视图）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id: organizationId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 解析查询参数（与 /api/workspaces/[id]/assets 保持一致）
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const requireLocation = searchParams.get("requireLocation") === "true";

    // 先查出该 organization 下的所有 workspace IDs
    const { data: workspaceRows, error: wsError } = await supabase
      .from("workspace")
      .select("id")
      .eq("organization_id", organizationId);

    if (wsError) {
      console.error("查询 workspaces 失败:", wsError);
      return NextResponse.json({ error: "查询工作空间失败" }, { status: 500 });
    }

    const workspaceIds = (workspaceRows ?? []).map((w) => w.id);

    if (workspaceIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // asset.workspace_id 是数组，使用 overlaps 判断是否与本组织的任一 workspace 相交。
    // 分页拉全量，避免 PostgREST 默认 1000 行上限截断（否则派生的 file_type 选项与列表都会缺失）。
    const { data, error } = await fetchAllRows(() => {
      let query = supabase
        .from("asset")
        .select("*")
        .overlaps("workspace_id", workspaceIds);

      if (type) {
        query = query.eq("file_type", type);
      }

      if (requireLocation) {
        query = query.not("location", "is", null);
      }

      return query;
    });

    if (error) {
      console.error("查询 assets 失败:", error);
      return NextResponse.json({ error: "查询资源失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 organization assets 失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
