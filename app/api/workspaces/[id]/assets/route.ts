import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: workspaceId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 特定类型过滤（如 "anchor"）
    const requireLocation = searchParams.get("requireLocation") === "true"; // 是否只返回有坐标的

    // 查询该 workspace 下的 assets
    // 使用 @> 运算符检查 workspace_id 数组是否包含当前 workspace
    let query = supabase
      .from("asset")
      .select("*")
      .contains("workspace_id", [workspaceId]);

    // 如果需要，过滤特定类型
    if (type) {
      query = query.eq("file_type", type);
    }

    // 如果需要，只返回有坐标的资源
    if (requireLocation) {
      query = query.not("location", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("查询 assets 失败:", error);
      return NextResponse.json({ error: "查询资源失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取 assets 失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
