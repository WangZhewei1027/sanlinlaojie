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
import { RuntimeNotFound, RuntimeUnavailable, submitAnonymousText } from "@/lib/placements/runtime.server";

// Anonymous submissions create a team text asset, its first version and a
// placement in the requested collection. The caller gains no editing rights.
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

    return json(await submitAnonymousText({ content, workspaceId, organizationId, lat, lng }));
  } catch (error) {
    if (error instanceof RuntimeNotFound) {
      return json({ error: "地图合集不存在" }, 404);
    }
    if (error instanceof RuntimeUnavailable) {
      return json({ error: "服务维护中，请稍后再试" }, 503);
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
