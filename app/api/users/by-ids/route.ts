import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/users/by-ids?ids=a,b,c
// 按用户ID批量解析 name/email。用于资产过滤器展示创建者——创建者ID由前端从
// 已加载的资产列表里去重得到，这里只负责把这批ID解析成显示名，结果集很小。
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ids = (searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email")
      .in("user_id", ids);

    if (error) {
      console.error("查询用户信息失败:", error);
      return NextResponse.json({ error: "查询用户信息失败" }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("查询用户信息失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
