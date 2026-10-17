import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { listOrganizationPlacements, parseStatus } from "@/lib/placements/service.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/organizations/[id]/placements?status= → { data: PlacementDto[] } (readable projects only)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/organizations/${id}/placements`, (actor) =>
    listOrganizationPlacements(actor, requireUuid(id, "organization id"), {
      status: parseStatus(new URL(request.url).searchParams.get("status") ?? undefined),
    }),
  );
}
