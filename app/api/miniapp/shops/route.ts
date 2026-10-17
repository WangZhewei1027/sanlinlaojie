import { db, sql } from "@/lib/db";
import { errorResponse, json, readJson, requireUuid } from "@/lib/miniapp/request";
import { scopeState, shopPlacements } from "@/lib/placements/runtime.server";

// Public: shop check-in points of a workspace. Legacy organizations: the
// `get_shop_assets` SQL function (same parameters and rows as the old RPC).
// Cut-over organizations: shop placements — including directory-only shops
// without coordinates — under their legacy public ids, so the client's
// checkedInShopIds stay valid.
//   POST { p_workspace_id, p_organization_id }
//   → [{ id, name, file_url, text_content, anchor_id, tag_ids, metadata, longitude, latitude, create_at }]
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const workspaceId = requireUuid(body.p_workspace_id, "p_workspace_id");
    const organizationId = requireUuid(body.p_organization_id, "p_organization_id");

    const scope = await scopeState({ workspaceId, organizationId });
    if (!scope) return json([]);
    if (scope.state === "v2") return json(await shopPlacements({ workspaceId, organizationId }));
    const { rows } = await sql`
      select * from public.get_shop_assets(${workspaceId}::uuid, ${organizationId}::uuid)
    `.execute(db);
    return json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
