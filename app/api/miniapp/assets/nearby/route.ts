import { db, sql } from "@/lib/db";
import {
  errorResponse,
  finiteNumber,
  json,
  optionalUuid,
  readJson,
} from "@/lib/miniapp/request";

// Public: GPS-mode asset lookup. Thin wrapper over the `get_nearby_assets`
// SQL function the mini-program used to call through PostgREST — same
// parameter names, same rows.
//   POST { user_lat, user_lng, max_distance_meters, p_workspace_id?, p_organization_id? }
//   → [{ id, file_type, file_url, text_content, metadata, config, is_huge, distance }]
const MAX_RADIUS_METERS = 5000;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const lat = finiteNumber(body.user_lat, -90, 90, "user_lat");
    const lng = finiteNumber(body.user_lng, -180, 180, "user_lng");
    const radius = finiteNumber(
      body.max_distance_meters,
      0,
      MAX_RADIUS_METERS,
      "max_distance_meters",
    );
    const workspaceId = optionalUuid(body.p_workspace_id, "p_workspace_id");
    const organizationId = optionalUuid(body.p_organization_id, "p_organization_id");

    const { rows } = await sql`
      select * from public.get_nearby_assets(
        ${lat}, ${lng}, ${radius}, ${workspaceId}::uuid, ${organizationId}::uuid
      )
    `.execute(db);
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
