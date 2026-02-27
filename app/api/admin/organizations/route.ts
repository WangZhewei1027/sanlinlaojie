import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET all organizations with members (super_admin only)
export async function GET() {
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
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userData?.role !== "super_admin") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("organization")
      .select(
        `
        id,
        name,
        description,
        created_at,
        created_by,
        organization_member (
          id,
          role,
          user_id,
          users (
            user_id,
            name,
            email
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取所有组织失败:", error);
    return NextResponse.json({ error: "获取组织失败" }, { status: 500 });
  }
}
