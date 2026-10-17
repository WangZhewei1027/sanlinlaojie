import { handleActorRoute, ok, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { createPlacement, listWorkspacePlacements, parseStatus } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// GET  /api/workspaces/[id]/placements?status=&include_shared=false → { data: PlacementDto[] }
// POST /api/workspaces/[id]/placements CreatePlacementRequest → { data: CreatePlacementResult } (201 new, 200 replay)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  return handleActorRoute(request, `/api/workspaces/${id}/placements`, (actor) =>
    listWorkspacePlacements(actor, requireUuid(id, "workspace id"), {
      status: parseStatus(search.get("status") ?? undefined),
      includeShared: search.get("include_shared") !== "false",
    }),
  );
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/placements`, async (actor) => {
    const result = await createPlacement(actor, requireUuid(id, "workspace id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
