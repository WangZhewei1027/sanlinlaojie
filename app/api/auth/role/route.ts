import { createClient } from "@/lib/supabase/server";
import { NextResponse, connection } from "next/server";

export async function GET() {
  await connection();
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("user_id, role")
      .eq("user_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({
      userId: userData.user_id,
      role: userData.role,
    });
  } catch (error) {
    console.error("获取用户角色失败:", error);
    return NextResponse.json({ error: "获取用户角色失败" }, { status: 500 });
  }
}
