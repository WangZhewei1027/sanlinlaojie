import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getActivity, updateActivity } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activities/${id}`, (actor) => getActivity(actor, requireUuid(id, "activity id")));
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activities/${id}`, async (actor) => updateActivity(actor, requireUuid(id, "activity id"), await readJsonBody(request)));
}
