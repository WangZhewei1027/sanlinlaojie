import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, role")
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取个人信息失败:", error);
    return NextResponse.json({ error: "获取个人信息失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "名称不能超过 50 个字符" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({ name })
      .eq("user_id", user.id)
      .select("user_id, name, email, role")
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("更新个人信息失败:", error);
    return NextResponse.json({ error: "更新个人信息失败" }, { status: 500 });
  }
}
