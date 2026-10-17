import { handleActorRoute, ok, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { publishScene } from "@/lib/scene/service.server";

type Context = { params: Promise<{ id: string }> };

// POST /api/scenes/[id]/publish PublishSceneRequest → { data: PublishSceneResult } (201 new, 200 replay)
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/scenes/${id}/publish`, async (actor) => {
    const result = await publishScene(actor, requireUuid(id, "scene id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
