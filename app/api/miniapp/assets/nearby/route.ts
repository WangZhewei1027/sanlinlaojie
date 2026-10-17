import { db, sql } from "@/lib/db";
import {
  errorResponse,
  finiteNumber,
  json,
  optionalUuid,
  readJson,
} from "@/lib/miniapp/request";
import { nearbyPlacements, scopeState } from "@/lib/placements/runtime.server";

// Public: GPS-mode asset lookup — same parameter names and rows as the old
// `get_nearby_assets` RPC. Legacy organizations are served by that SQL
// function (which skips cut-over and archived scopes); cut-over organizations
// by their active placements, projected into the same row shape with the
// legacy public id.
//   POST { user_lat, user_lng, max_distance_meters, p_workspace_id?, p_organization_id? }
//   → [{ id, file_type, file_url, text_content, metadata, config, is_huge, distance }]
const MAX_RADIUS_METERS = 5000;

interface NearbyRow {
  distance: number;
}

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
    const scope = { workspaceId, organizationId };

    // An explicit scope is served by exactly one model; no scope spans both.
    const state = workspaceId || organizationId ? (await scopeState(scope))?.state : null;
    const [legacy, placements] = await Promise.all([
      state === "v2"
        ? Promise.resolve([] as NearbyRow[])
        : sql<NearbyRow>`
            select * from public.get_nearby_assets(
              ${lat}, ${lng}, ${radius}, ${workspaceId}::uuid, ${organizationId}::uuid
            )
          `.execute(db).then((r) => r.rows),
      state === "v2" || state === null ? nearbyPlacements(scope, lat, lng, radius) : Promise.resolve([]),
    ]);
    const rows: NearbyRow[] = [...legacy, ...placements];
    rows.sort((a, b) => a.distance - b.distance);
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
