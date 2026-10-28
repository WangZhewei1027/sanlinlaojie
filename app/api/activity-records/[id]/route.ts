import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { moderateActivityRecord } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activity-records/${id}`, async (actor) => moderateActivityRecord(actor, requireUuid(id, "record id"), await readJsonBody(request)));
}
