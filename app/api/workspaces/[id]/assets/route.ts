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

    // 查询该 workspace 下所有有坐标的 assets
    const { data, error } = await supabase
      .from("asset")
      .select("id, file_type, file_url, metadata")
      .eq("workspace_id", workspaceId)
      .not("location", "is", null);

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
