import { handleActorRoute, ok } from "@/lib/content-model/http.server";
import { queryInt, requireUuid } from "@/lib/content-model/input";
import { listActivityRecords } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activities/${id}/records`, async (actor) => {
    const query = new URL(request.url).searchParams;
    const result = await listActivityRecords(actor, requireUuid(id, "activity id"), {
      placementId: query.get("placementId") || undefined, limit: queryInt(query, "limit", 50, 1, 200), offset: queryInt(query, "offset", 0, 0, 1000000),
    });
    return ok(result.data, 200, { page: result.page });
  });
}
