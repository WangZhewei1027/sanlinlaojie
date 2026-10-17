import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getPlacementContent } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/placements/[id]/content?workspace_id=<viewer project> → { data: PlacementContentDto }
// Fixed playable content of the placement only (pinned version or frozen revision);
// same read rule as GET /api/placements/[id], including active legacy scopes.
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = new URL(request.url).searchParams.get("workspace_id");
  return handleActorRoute(request, `/api/placements/${id}/content`, (actor) =>
    getPlacementContent(actor, requireUuid(id, "placement id"), viewer ? requireUuid(viewer, "workspace_id") : undefined),
  );
}
