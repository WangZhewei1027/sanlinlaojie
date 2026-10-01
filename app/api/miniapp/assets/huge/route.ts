import { db, sql } from "@/lib/db";
import {
  errorResponse,
  json,
  optionalUuid,
  readJson,
  requireUuid,
} from "@/lib/miniapp/request";

// Public: far-away "huge" models for an organization / workspace. Wraps the
// `get_huge_assets` SQL function (same parameters and rows as the old RPC).
//   POST { p_organization_id, p_workspace_id? }
//   → [{ id, file_type, file_url, text_content, metadata, config, latitude, longitude }]
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const organizationId = requireUuid(body.p_organization_id, "p_organization_id");
    const workspaceId = optionalUuid(body.p_workspace_id, "p_workspace_id");

    const { rows } = await sql`
      select * from public.get_huge_assets(${workspaceId}::uuid, ${organizationId}::uuid)
    `.execute(db);
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
