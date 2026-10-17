import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getScene, saveScene } from "@/lib/scene/service.server";

type Context = { params: Promise<{ id: string }> };

// GET   /api/scenes/[id] → { data: SceneDetailDto } (draft + pinned resources)
// PATCH /api/scenes/[id] SaveSceneRequest → { data: SceneDetailDto }; 428 without expectedLockVersion, 409 when stale
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/scenes/${id}`, (actor) => getScene(actor, requireUuid(id, "scene id")));
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/scenes/${id}`, async (actor) => saveScene(actor, requireUuid(id, "scene id"), await readJsonBody(request)));
}
