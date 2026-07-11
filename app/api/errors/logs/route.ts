import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, connection } from "next/server";
import { logErrorSafe } from "@/lib/log-error";

const MAX_LIMIT = 200;

/**
 * Super-admin Error Log query endpoint. Verifies the caller is super_admin,
 * then delegates filtering + pagination + aggregation to the `error_log_query`
 * Postgres function via the service-role client (error_log is service-role
 * only). Returns { total, rows, stats } for the analysis page.
 *
 * Query params: scope, statusClass ('zero'|'4xx'|'5xx'), q, from, to, limit,
 * offset. All optional.
 */
export async function GET(request: Request) {
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
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userData?.role !== "super_admin") {
      await logErrorSafe({
        userId: user.id,
        method: "GET",
        path: "/api/errors/logs",
        status: 403,
        message: "权限不足: 仅 super_admin",
      });
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const statusClass = url.searchParams.get("statusClass");
    const q = url.searchParams.get("q");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("error_log_query", {
      p_scope: scope === "client" || scope === "api" ? scope : null,
      p_status_class:
        statusClass === "zero" ||
        statusClass === "4xx" ||
        statusClass === "5xx"
          ? statusClass
          : null,
      p_q: q && q.trim() ? q.trim() : null,
      p_from: from || null,
      p_to: to || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("获取错误日志失败:", error);
    await logErrorSafe({
      method: "GET",
      path: "/api/errors/logs",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "获取错误日志失败" }, { status: 500 });
  }
}
