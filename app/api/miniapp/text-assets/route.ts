import { db, sql } from "@/lib/db";
import { logError } from "@/lib/log-error";
import { allowRequest } from "@/lib/miniapp/rate-limit";
import {
  clientIp,
  errorResponse,
  finiteNumber,
  json,
  MiniappError,
  optionalUuid,
  readJson,
  requireUuid,
} from "@/lib/miniapp/request";

// Public: anonymous text asset / 弹幕 from the mini-program. Wraps the
// `upload_text_asset` SQL function (same parameters; the row is attributed to
// the fixed mini-program user inside the function, as before).
//   POST { content, p_workspace_id, p_organization_id?, user_lat?, user_lng? }
//   → { id, file_type, text_content, metadata, create_at }
//
// The old PostgREST path let anyone with the anon key write unlimited rows to
// any workspace; this endpoint adds a content length cap and per-IP /
// per-workspace rate limits.
const MAX_CONTENT_CHARS = 500;
const WINDOW_MS = 60_000;
const PER_IP_PER_MINUTE = 20;
const PER_WORKSPACE_PER_MINUTE = 120;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const content =
      typeof body.content === "string" ? body.content.trim() : "";
    if (!content) throw new MiniappError("content is required");
    if (content.length > MAX_CONTENT_CHARS)
      throw new MiniappError(`content exceeds ${MAX_CONTENT_CHARS} characters`);
    const workspaceId = requireUuid(body.p_workspace_id, "p_workspace_id");
    const organizationId = optionalUuid(body.p_organization_id, "p_organization_id");
    const hasLocation = body.user_lat != null && body.user_lng != null;
    const lat = hasLocation ? finiteNumber(body.user_lat, -90, 90, "user_lat") : null;
    const lng = hasLocation ? finiteNumber(body.user_lng, -180, 180, "user_lng") : null;

    const ip = clientIp(request);
    if (
      !allowRequest(`text:ip:${ip}`, PER_IP_PER_MINUTE, WINDOW_MS) ||
      !allowRequest(`text:ws:${workspaceId}`, PER_WORKSPACE_PER_MINUTE, WINDOW_MS)
    ) {
      return json({ error: "发送过于频繁，请稍后再试" }, 429);
    }

    const { rows } = await sql<{ v: unknown }>`
      select public.upload_text_asset(
        ${content}, ${workspaceId}::uuid, ${organizationId}::uuid,
        ${lng}::double precision, ${lat}::double precision, null::jsonb
      ) as v
    `.execute(db);
    return json(rows[0]?.v ?? null);
  } catch (error) {
    // The SQL function raises when the workspace/org pair does not exist.
    if (
      error instanceof Error &&
      /Workspace not found|No user found/.test(error.message)
    ) {
      return json({ error: "工作空间不存在" }, 404);
    }
    if (!(error instanceof MiniappError)) {
      await logError({
        method: "POST",
        path: "/api/miniapp/text-assets",
        status: 503,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return errorResponse(error, "发送失败，请稍后重试");
  }
}
