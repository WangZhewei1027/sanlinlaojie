import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getPlacementContent } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/placements/[id]/content?workspace_id=<viewer project> → { data: PlacementContentDto }
// Current playable content of the placement;
// same team read rule as GET /api/placements/[id].
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = new URL(request.url).searchParams.get("workspace_id");
  return handleActorRoute(request, `/api/placements/${id}/content`, (actor) =>
    getPlacementContent(actor, requireUuid(id, "placement id"), viewer ? requireUuid(viewer, "workspace_id") : undefined),
  );
}
