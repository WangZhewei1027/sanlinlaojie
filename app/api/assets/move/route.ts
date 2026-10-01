import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getWorkspaceOrgIds } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

interface AssetMove {
  assetId: string;
  longitude: number;
  latitude: number;
  height: number;
}

/**
 * 批量移动素材坐标。拖动松手后一次性提交所有被拖素材的新坐标，
 * 服务端一次鉴权 + 一条 SQL（move_assets 函数）更新，避免每个素材单发一次 PATCH。
 */
export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawMoves: AssetMove[] = Array.isArray(body?.moves) ? body.moves : [];

    // 只保留坐标合法的项
    const moves = rawMoves.filter(
      (m) =>
        m &&
        typeof m.assetId === "string" &&
        Number.isFinite(m.longitude) &&
        Number.isFinite(m.latitude),
    );

    if (moves.length === 0) {
      return NextResponse.json({ error: "缺少 moves" }, { status: 400 });
    }

    const ids = moves.map((m) => m.assetId);

    // 鉴权：super_admin 放行；否则要求对涉及的每个 org 都有 org.assets.write。
    const userData = await db
      .selectFrom("users")
      .select("role")
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (!isSuperAdmin(userData?.role)) {
      const assetRows = await db
        .selectFrom("asset")
        .select("workspace_id")
        .where("id", "in", ids)
        .execute();

      const allWorkspaceIds = Array.from(
        new Set(assetRows.flatMap((a) => a.workspace_id ?? [])),
      );
      const orgIds = await getWorkspaceOrgIds(allWorkspaceIds);

      const deny = async (msg: string) => {
        await logError({
          userId: user.id,
          method: "POST",
          path: "/api/assets/move",
          status: 403,
          message: msg,
          context: { orgIds },
        });
        return NextResponse.json({ error: "权限不足" }, { status: 403 });
      };

      if (orgIds.length === 0) {
        return deny("权限不足: 资产无有效 org 归属");
      }

      const memberships = await db
        .selectFrom("organization_member")
        .select(["organization_id", "role"])
        .where("user_id", "=", user.id)
        .where("organization_id", "in", orgIds)
        .execute();

      const roleByOrg = new Map(
        memberships.map((m) => [m.organization_id, m.role] as const),
      );

      for (const orgId of orgIds) {
        if (!hasOrgPermission(roleByOrg.get(orgId), "org.assets.write")) {
          return deny("权限不足: org.assets.write");
        }
      }
    }

    // 一条 SQL 批量写 location + metadata 坐标（public.move_assets 不变）
    await sql`select public.move_assets(${JSON.stringify(moves)}::jsonb)`.execute(db);

    return NextResponse.json({ success: true, count: moves.length });
  } catch (error) {
    console.error("批量移动资产失败:", error);
    await logError({
      method: "POST",
      path: "/api/assets/move",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "保存位置失败" }, { status: 500 });
  }
}
