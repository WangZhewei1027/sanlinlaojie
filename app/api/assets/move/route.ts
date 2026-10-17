import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { legacyPathMode, loadActor } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, hasContentModelHeader, ok, readJsonBody, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { requireLegacyRowEdit, requireRowMembership, rowOrganizations } from "@/lib/assets/legacy.server";
import { movePlacements } from "@/lib/placements/service.server";

interface AssetMove {
  assetId: string;
  longitude: number;
  latitude: number;
  height: number;
}

/**
 * 批量移动。拖动松手后一次性提交所有被拖对象的新坐标。
 *
 * - 旧组织：素材行坐标，鉴权为每行所在每个项目的编辑权，一条 SQL（move_assets）。
 * - 已切换组织：仅接受 X-Content-Model: 2 且 `action: "placement.move"` 的投放
 *   移动（等同 POST /api/placements/move，逐项检查项目权限与锁版本）；旧格式
 *   请求返回 409，绝不把投放 ID 当作素材行写入。
 */
export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const actor = await loadActor(db, userId);
    const body = await readJsonBody(request).catch(() => ({}) as Record<string, unknown>);

    if (hasContentModelHeader(request) && body.action === "placement.move") {
      const { action: _action, ...rest } = body;
      return ok(await movePlacements(actor, rest));
    }

    const rawMoves: AssetMove[] = Array.isArray(body?.moves) ? (body.moves as AssetMove[]) : [];
    // 只保留坐标合法的项
    const moves = rawMoves.filter(
      (m) => m && isUuid(m.assetId) && Number.isFinite(m.longitude) && Number.isFinite(m.latitude),
    );
    if (moves.length === 0) {
      return NextResponse.json({ error: "缺少 moves" }, { status: 400 });
    }

    const rows = await db
      .selectFrom("asset")
      .select(["id", "workspace_id", "organization_id"])
      .where("id", "in", moves.map((m) => m.assetId))
      .execute();
    if (rows.length !== new Set(moves.map((m) => m.assetId)).size) throw new ContentError("NOT_FOUND", "资源不存在");
    const orgs = await rowOrganizations(db, rows);
    await requireRowMembership(db, actor, orgs);
    const mode = legacyPathMode(orgs, hasContentModelHeader(request));
    if (mode === "v2") throw new ContentError("VALIDATION_FAILED", "新内容模型只能移动投放：请使用 action \"placement.move\" 与 placementId");

    for (const row of rows) await requireLegacyRowEdit(db, actor, row);

    // 一条 SQL 批量写 location + metadata 坐标（public.move_assets 不变）
    await sql`select public.move_assets(${JSON.stringify(moves)}::jsonb)`.execute(db);

    return NextResponse.json({ success: true, count: moves.length });
  } catch (error) {
    return failure(error, { method: "POST", path: "/api/assets/move", userId });
  }
}
