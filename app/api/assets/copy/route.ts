import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { legacyPathMode, loadActor } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, hasContentModelHeader, ok, readJsonBody, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid, requireUuidList } from "@/lib/content-model/input";
import { requireLegacyRowEdit, requireRowMembership, rowOrganizations } from "@/lib/assets/legacy.server";
import { copyPlacement } from "@/lib/placements/service.server";
import type { CreatePlacementResult } from "@/lib/content-model/contracts";

interface SourceAsset {
  id: string;
  name: string | null;
  file_type: string;
  file_url: string | null;
  content_hash: string | null;
  text_content: string | null;
  anchor_id: string | null;
  tag_ids: string[] | null;
  is_huge: boolean | null;
  config: Record<string, unknown> | null;
  workspace_id: string[] | null;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
}

const SELECT_COLUMNS = [
  "id",
  "name",
  "file_type",
  "file_url",
  "content_hash",
  "text_content",
  "anchor_id",
  "tag_ids",
  "is_huge",
  "config",
  "workspace_id",
  "organization_id",
  "metadata",
] as const;

/**
 * 复制。
 *
 * - 旧组织：复制素材行。新行复用源的 file_url / content_hash（不重复上传），
 *   坐标加一个小偏移；鉴权为源行所在每个项目的编辑权。
 * - 已切换组织：仅接受 X-Content-Model: 2 且 `action: "placement.copy"`，
 *   逐个调用投放复制（独立 ID 与公开 ID，固定同一内容）。
 */
export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const actor = await loadActor(db, userId);
    const body = await readJsonBody(request).catch(() => ({}) as Record<string, unknown>);

    if (hasContentModelHeader(request) && body.action === "placement.copy") {
      const ids = requireUuidList(body.placementIds, "placementIds", 50);
      const results: CreatePlacementResult[] = [];
      for (const id of ids) {
        results.push(
          await copyPlacement(actor, id, {
            ...(body.targetWorkspaceId !== undefined ? { targetWorkspaceId: body.targetWorkspaceId } : {}),
            ...(body.offsetMeters !== undefined ? { offsetMeters: body.offsetMeters } : {}),
            // Per-item key: a retried batch replays committed copies instead of duplicating them.
            ...(typeof body.idempotencyKey === "string" ? { idempotencyKey: `${body.idempotencyKey}:${id}` } : {}),
          }),
        );
      }
      return ok(results, 201);
    }

    const ids: string[] = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter(isUuid) : [];
    const offsetMeters: number =
      typeof body?.offsetMeters === "number" && body.offsetMeters > 0
        ? body.offsetMeters
        : 4;

    if (ids.length === 0) {
      return NextResponse.json({ error: "缺少 ids" }, { status: 400 });
    }

    // jsonb 列读出来已是解析后的对象
    const sources = (await db
      .selectFrom("asset")
      .select(SELECT_COLUMNS)
      .where("id", "in", ids)
      .execute()) as SourceAsset[];

    if (sources.length === 0) {
      return NextResponse.json({ error: "资源不存在" }, { status: 404 });
    }

    const orgs = await rowOrganizations(db, sources);
    await requireRowMembership(db, actor, orgs);
    const mode = legacyPathMode(orgs, hasContentModelHeader(request));
    if (mode === "v2") throw new ContentError("VALIDATION_FAILED", "新内容模型只能复制投放：请使用 action \"placement.copy\" 与 placementIds");
    for (const source of sources) await requireLegacyRowEdit(db, actor, source);

    // 用第一个带坐标素材的纬度算一次偏移量（度），所有副本套用同一偏移，保持相对布局。
    const refLat =
      sources
        .map((a) => a.metadata?.latitude)
        .find((v): v is number => typeof v === "number") ?? 0;
    const dLat = offsetMeters / 111320;
    const dLng =
      offsetMeters / (111320 * Math.cos((refLat * Math.PI) / 180) || 111320);

    const insertPayloads = sources.map((src) => {
      const lng = src.metadata?.longitude;
      const lat = src.metadata?.latitude;
      const hasCoords = typeof lng === "number" && typeof lat === "number";

      const newLng = hasCoords ? (lng as number) + dLng : undefined;
      const newLat = hasCoords ? (lat as number) + dLat : undefined;

      const metadata = hasCoords
        ? { ...(src.metadata ?? {}), longitude: newLng, latitude: newLat }
        : src.metadata ?? {};

      return {
        workspace_id: src.workspace_id ?? [],
        created_by: actor.userId,
        file_type: src.file_type,
        file_url: src.file_url,
        content_hash: src.content_hash,
        text_content: src.text_content,
        anchor_id: src.anchor_id,
        tag_ids: src.tag_ids,
        is_huge: src.is_huge ?? false,
        // jsonb 列按字符串写入
        config: JSON.stringify(src.config ?? {}),
        name: src.name ? `${src.name} 副本` : null,
        metadata: JSON.stringify(metadata),
        // WKT 原样写入，由 Postgres 转成 geometry
        location: hasCoords ? `POINT(${newLng} ${newLat})` : null,
      };
    });

    const data = await db
      .insertInto("asset")
      .values(insertPayloads)
      .returning([
        "id",
        "name",
        "file_type",
        "file_url",
        "text_content",
        "anchor_id",
        "tag_ids",
        "metadata",
        "workspace_id",
        "is_huge",
        "config",
        "content_hash",
      ])
      .execute();

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return failure(error, { method: "POST", path: "/api/assets/copy", userId });
  }
}
