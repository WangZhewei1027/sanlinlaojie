import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { listCollectionActivityPlacements } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}/activity-placements`, (actor) => listCollectionActivityPlacements(actor, requireUuid(id, "collection id")));
}
