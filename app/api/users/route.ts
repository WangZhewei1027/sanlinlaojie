import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse, connection } from "next/server";

// Fetch last_sign_in_at for every auth user (lives in the auth schema, not
// reachable via PostgREST). Returns a map keyed by user id; on any failure it
// returns an empty map so the user list still renders.
async function fetchLastSignInMap(): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return map;

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    for (const u of data.users) map.set(u.id, u.last_sign_in_at ?? null);
    if (data.users.length < perPage) break;
  }
  return map;
}

export async function GET() {
  await connection();
  try {
    const supabase = await createClient();

    // 检查权限
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

    // 获取所有用户及其 workspace 分配情况
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        user_id,
        name,
        email,
        role,
        created_at,
        workspace_assignment (
          id,
          workspace_id,
          role,
          created_at,
          workspace (
            id,
            name
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Merge in last_sign_in_at from the auth schema.
    const lastSignInMap = await fetchLastSignInMap();
    const data = (users ?? []).map((u) => ({
      ...u,
      last_sign_in_at: lastSignInMap.get(u.user_id) ?? null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}
