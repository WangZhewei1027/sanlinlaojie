import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getCollection, updateCollection } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// GET   /api/collections/[id] → { data: WorkspaceDto }
// PATCH /api/collections/[id] { name?, description? } → { data: WorkspaceDto } (open collection, team writer)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}`, (actor) => getCollection(actor, requireUuid(id, "collection id")));
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}`, async (actor) => updateCollection(actor, requireUuid(id, "collection id"), await readJsonBody(request)));
}
