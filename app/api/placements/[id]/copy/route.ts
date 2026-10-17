import { handleActorRoute, ok, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { copyPlacement } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// POST /api/placements/[id]/copy CopyPlacementRequest → { data: CreatePlacementResult } (201 new, 200 replay)
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/placements/${id}/copy`, async (actor) => {
    const result = await copyPlacement(actor, requireUuid(id, "placement id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
