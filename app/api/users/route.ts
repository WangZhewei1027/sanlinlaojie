import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createAdminClient as createServiceClient } from "@/lib/supabase/admin";
import { NextResponse, connection } from "next/server";
import { logErrorSafe } from "@/lib/log-error";

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
      await logErrorSafe({
        userId: user.id,
        method: "GET",
        path: "/api/users",
        status: 403,
        message: "权限不足: 仅 super_admin",
      });
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
    await logErrorSafe({
      method: "GET",
      path: "/api/users",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

// 手动注册用户（仅 super_admin）。通过 service role 创建 auth 用户
// 并同步 public.users；邮箱自动确认，无需验证流程。
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data: callerData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (callerData?.role !== "super_admin") {
      await logErrorSafe({
        userId: user.id,
        method: "POST",
        path: "/api/users",
        status: 403,
        message: "权限不足: 仅 super_admin 可创建用户",
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = body.role ?? "user";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码长度至少 6 位" },
        { status: 400 },
      );
    }
    if (!["user", "super_admin"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 });
    }

    const admin = createServiceClient();

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : {},
      });

    if (createError) {
      if (createError.code === "email_exists") {
        return NextResponse.json({ error: "该邮箱已被注册" }, { status: 400 });
      }
      throw createError;
    }

    const userId = created.user.id;

    const { error: upsertError } = await admin.from("users").upsert(
      {
        user_id: userId,
        email,
        name: name || null,
        role,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      // 同步 public.users 失败则回滚 auth 用户，保证接口可重试
      await admin.auth.admin.deleteUser(userId);
      throw upsertError;
    }

    return NextResponse.json({ data: { user_id: userId, email, name, role } });
  } catch (error) {
    console.error("创建用户失败:", error);
    await logErrorSafe({
      method: "POST",
      path: "/api/users",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}
