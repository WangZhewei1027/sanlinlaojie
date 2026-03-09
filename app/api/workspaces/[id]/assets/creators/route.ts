import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id: workspaceId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 查询该 workspace 下所有 asset 的 created_by（去重）
    const { data: assets, error: assetsError } = await supabase
      .from("asset")
      .select("created_by")
      .contains("workspace_id", [workspaceId])
      .not("created_by", "is", null);

    if (assetsError) {
      console.error("查询 asset creators 失败:", assetsError);
      return NextResponse.json({ error: "查询创建者失败" }, { status: 500 });
    }

    // 去重 created_by
    const uniqueUserIds = [
      ...new Set(assets.map((a) => a.created_by as string)),
    ];

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 从 users 表获取用户信息
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("user_id, name, email")
      .in("user_id", uniqueUserIds);

    if (usersError) {
      console.error("查询用户信息失败:", usersError);
      return NextResponse.json({ error: "查询用户信息失败" }, { status: 500 });
    }

    return NextResponse.json({ data: users || [] });
  } catch (error) {
    console.error("获取 asset creators 失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
