import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getActivityPlacement, updateActivityPlacement } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activity-placements/${id}`, (actor) => getActivityPlacement(actor, requireUuid(id, "placement id")));
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activity-placements/${id}`, async (actor) => updateActivityPlacement(actor, requireUuid(id, "placement id"), await readJsonBody(request)));
}
