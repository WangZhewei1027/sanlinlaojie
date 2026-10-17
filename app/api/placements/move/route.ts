import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { movePlacements } from "@/lib/placements/service.server";

// POST /api/placements/move MovePlacementsRequest → { data: PlacementDto[] } (all-or-nothing)
export async function POST(request: Request) {
  return handleActorRoute(request, "/api/placements/move", async (actor) => movePlacements(actor, await readJsonBody(request)));
}
