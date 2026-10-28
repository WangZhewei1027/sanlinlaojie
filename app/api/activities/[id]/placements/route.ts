import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { createActivityPlacement, listActivityPlacements } from "@/lib/activities/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activities/${id}/placements`, (actor) => listActivityPlacements(actor, requireUuid(id, "activity id")));
}
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/activities/${id}/placements`, async (actor) => createActivityPlacement(actor, requireUuid(id, "activity id"), await readJsonBody(request)), 201);
}
