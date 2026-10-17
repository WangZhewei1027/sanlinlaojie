import { resolveSceneAsset } from "@/lib/scene/asset.server";
import { createBlankScene } from "@/lib/scene/protocol";
import { SceneAssetError } from "@/lib/scene/validate";
import { trySyncAnchor, referenceUrl } from "@/lib/anchor/embedding.server";
import { validateAnchorLink } from "@/lib/anchor/access.server";
import { MatchingError, finiteNumber } from "@/lib/anchor-matching";
import { NextResponse } from "next/server";
import type { Insertable } from "kysely";
import { db, sql, type DB } from "@/lib/db";
import { legacyPathMode, loadActor, requireWorkspaceEdit, requireWorkspaceRead } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, hasContentModelHeader, ok, readJsonBody, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { createAssetInWorkspace, listWorkspaceAssets, parseAssetListQuery } from "@/lib/assets/service.server";
import { createAnchorV2 } from "@/lib/assets/legacy.server";

type Context = { params: Promise<{ id: string }> };

/**
 * GET — requires read access to the project.
 *   X-Content-Model: 2 → project assets via grants: ApiPage<AssetDto>
 *     (?q=&file_type=&origin=&state=&limit=&offset=)
 *   otherwise          → v1 projection: legacy rows of this workspace
 *     (?type=&requireLocation=true), frozen read-only after cutover.
 */
export async function GET(request: Request, { params }: Context) {
  const { id: workspaceId } = await params;
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    if (!isUuid(workspaceId)) throw new ContentError("NOT_FOUND", "项目不存在");
    const actor = await loadActor(db, userId);
    const { searchParams } = new URL(request.url);
    if (hasContentModelHeader(request)) {
      const page = await listWorkspaceAssets(actor, workspaceId, parseAssetListQuery(searchParams));
      return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
    }
    await requireWorkspaceRead(db, actor, workspaceId);

    const type = searchParams.get("type"); // 特定类型过滤（如 "anchor"）
    const requireLocation = searchParams.get("requireLocation") === "true"; // 是否只返回有坐标的

    // @> 检查 workspace_id 数组是否包含当前 workspace；一次拉全量。
    let query = db
      .selectFrom("asset")
      .selectAll()
      .where(sql<boolean>`workspace_id @> array[${workspaceId}::uuid]`);
    if (type) query = query.where("file_type", "=", type);
    if (requireLocation) query = query.where("location", "is not", null);

    return NextResponse.json({ data: await query.execute() });
  } catch (error) {
    return failure(error, { method: "GET", path: `/api/workspaces/${workspaceId}/assets`, userId });
  }
}

/**
 * POST — requires edit rights on the project.
 *   Cut-over organization + X-Content-Model: 2 → CreateAssetRequest: Asset +
 *     immutable v1 + origin grant (+ optional placement), idempotent; anchors
 *     keep the legacy field shape and their dedicated service.
 *   Legacy organization → unchanged legacy row insert.
 *   Cut-over organization without the header → 409 CONTENT_MODEL_UPGRADE_REQUIRED.
 */
export async function POST(request: Request, { params }: Context) {
  const { id: workspaceId } = await params;
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    if (!isUuid(workspaceId)) throw new ContentError("NOT_FOUND", "工作空间不存在");
    const actor = await loadActor(db, userId);
    const project = await requireWorkspaceEdit(db, actor, workspaceId);
    const mode = legacyPathMode([project.org], hasContentModelHeader(request));

    if (mode === "v2") {
      const body = await readJsonBody(request);
      if (body.file_type === "anchor") return ok(await createAnchorV2(actor, workspaceId, body), 201);
      const result = await createAssetInWorkspace(actor, workspaceId, body);
      return ok(result, result.created ? 201 : 200);
    }

    const body = await request.json();
    const {
      name,
      file_type,
      file_url,
      text_content,
      location,
      tag_ids,
      metadata,
      anchor_id,
      is_huge,
      config,
      content_hash,
    } = body ?? {};

    if (!file_type) {
      return NextResponse.json({ error: "缺少 file_type" }, { status: 400 });
    }

    await validateAnchorLink(anchor_id, file_type, [workspaceId]);
    if (file_type === "anchor") {
      if (typeof name !== "string" || !name.trim()) throw new MatchingError("匹配点必须输入名称");
      referenceUrl(file_url);
      finiteNumber(metadata?.latitude, -90, 90, "latitude");
      finiteNumber(metadata?.longitude, -180, 180, "longitude");
    }
    if (file_type === "scene") {
      if (typeof name !== "string" || !name.trim()) throw new SceneAssetError("场景必须输入标题");
      if (file_url || is_huge) throw new SceneAssetError("场景使用 JSON 内容，不支持文件地址或大型模型标记");
      await resolveSceneAsset(text_content ?? JSON.stringify(createBlankScene()), [workspaceId]);
    }
    // 白名单字段；workspace_id / created_by 由服务端定，不信任 body
    const insertPayload: Insertable<DB["asset"]> = {
      workspace_id: [workspaceId],
      created_by: actor.userId,
      file_type,
    };
    if (name !== undefined) insertPayload.name = name;
    if (file_url !== undefined) insertPayload.file_url = file_url;
    if (text_content !== undefined) insertPayload.text_content = text_content;
    if (file_type === "scene") insertPayload.text_content = text_content ?? JSON.stringify(createBlankScene());
    // location 为 WKT（如 "POINT(lng lat)"），原样写入，由 Postgres 转成 geometry
    if (location !== undefined) insertPayload.location = location;
    if (tag_ids !== undefined) insertPayload.tag_ids = tag_ids;
    // jsonb 列按字符串写入（pg 会把 JS 数组序列化成 Postgres 数组，不能直接传对象/数组）
    if (metadata !== undefined) insertPayload.metadata = metadata === null ? null : JSON.stringify(metadata);
    if (anchor_id !== undefined) insertPayload.anchor_id = anchor_id;
    if (is_huge !== undefined) insertPayload.is_huge = is_huge;
    if (config !== undefined) insertPayload.config = config === null ? null : JSON.stringify(config);
    if (content_hash !== undefined) insertPayload.content_hash = content_hash;

    if (file_type === "anchor") insertPayload.location = `POINT(${metadata.longitude} ${metadata.latitude})`;
    const data = await db
      .insertInto("asset")
      .values(insertPayload)
      .returningAll()
      .executeTakeFirstOrThrow();

    await trySyncAnchor(data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof SceneAssetError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof MatchingError) return NextResponse.json({ error: error.message }, { status: error.status });
    return failure(error, { method: "POST", path: `/api/workspaces/${workspaceId}/assets`, userId });
  }
}
