import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { optionalEnum, requireUuid } from "@/lib/content-model/input";
import { createScene, listScenes } from "@/lib/scene/service.server";

type Context = { params: Promise<{ id: string }> };

// Compatibility adapter; scenes belong to the team (see /api/organizations/[id]/scenes).
// GET  /api/workspaces/[id]/scenes?state=active|archived|all → { data: SceneSummaryDto[] } (every team scene)
// POST /api/workspaces/[id]/scenes CreateSceneRequest → 201 { data: SceneDetailDto } (workspace_id = origin)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/scenes`, (actor) =>
    listScenes(actor, requireUuid(id, "workspace id"), {
      state: optionalEnum(new URL(request.url).searchParams.get("state") ?? undefined, "state", ["active", "archived", "all"] as const),
    }),
  );
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(
    request,
    `/api/workspaces/${id}/scenes`,
    async (actor) => createScene(actor, requireUuid(id, "workspace id"), await readJsonBody(request)),
    201,
  );
}
