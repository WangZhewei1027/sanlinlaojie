import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { copyScene } from "@/lib/scene/service.server";

type Context = { params: Promise<{ id: string }> };

// POST /api/scenes/[id]/copy CopySceneRequest → 201 { data: SceneDetailDto }
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/scenes/${id}/copy`, async (actor) => copyScene(actor, requireUuid(id, "scene id"), await readJsonBody(request)), 201);
}
