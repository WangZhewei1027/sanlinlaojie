import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { archivePlacement, getPlacement, parseArchiveLock, updatePlacement } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// GET    /api/placements/[id]?workspace_id=<viewer project> → { data: PlacementDto }
// PATCH  /api/placements/[id] UpdatePlacementRequest → { data: PlacementDto }
// DELETE /api/placements/[id]?expectedLockVersion=N → archive → { data: PlacementDto }
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const viewer = new URL(request.url).searchParams.get("workspace_id");
  return handleActorRoute(request, `/api/placements/${id}`, (actor) =>
    getPlacement(actor, requireUuid(id, "placement id"), viewer ? requireUuid(viewer, "workspace_id") : undefined),
  );
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/placements/${id}`, async (actor) => updatePlacement(actor, requireUuid(id, "placement id"), await readJsonBody(request)));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/placements/${id}`, (actor) =>
    archivePlacement(actor, requireUuid(id, "placement id"), parseArchiveLock(new URL(request.url).searchParams)),
  );
}
