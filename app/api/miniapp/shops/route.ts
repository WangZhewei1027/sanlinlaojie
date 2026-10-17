import { errorResponse, json, readJson, requireUuid } from "@/lib/miniapp/request";
import { shopPlacements } from "@/lib/placements/runtime.server";

// Public: shop placements, including directory-only shops without coordinates.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const workspaceId = requireUuid(body.p_workspace_id, "p_workspace_id");
    const organizationId = requireUuid(body.p_organization_id, "p_organization_id");

    return json(await shopPlacements({ workspaceId, organizationId }));
  } catch (error) {
    return errorResponse(error);
  }
}
