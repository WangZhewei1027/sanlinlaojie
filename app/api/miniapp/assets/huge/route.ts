import { db, sql } from "@/lib/db";
import {
  errorResponse,
  json,
  optionalUuid,
  readJson,
  requireUuid,
} from "@/lib/miniapp/request";
import { hugePlacements, scopeState } from "@/lib/placements/runtime.server";

// Public: far-away "huge" models for an organization / workspace. Legacy
// organizations: the `get_huge_assets` SQL function (same parameters and
// rows as the old RPC). Cut-over organizations: active model placements with
// render_config.is_huge, in the same row shape.
//   POST { p_organization_id, p_workspace_id? }
//   → [{ id, file_type, file_url, text_content, metadata, config, latitude, longitude }]
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const organizationId = requireUuid(body.p_organization_id, "p_organization_id");
    const workspaceId = optionalUuid(body.p_workspace_id, "p_workspace_id");

    const scope = await scopeState({ workspaceId, organizationId });
    if (!scope) return json([]);
    if (scope.state === "v2") return json(await hugePlacements({ workspaceId, organizationId }));
    const { rows } = await sql`
      select * from public.get_huge_assets(${workspaceId}::uuid, ${organizationId}::uuid)
    `.execute(db);
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
