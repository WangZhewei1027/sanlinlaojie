import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { listRevisions } from "@/lib/scene/service.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/scenes/[id]/revisions → { data: SceneRevisionSummaryDto[] } (newest first)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/scenes/${id}/revisions`, (actor) => listRevisions(actor, requireUuid(id, "scene id")));
}
