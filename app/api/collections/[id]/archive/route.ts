import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { setWorkspaceArchived } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// POST   /api/collections/[id]/archive → archive → { data: WorkspaceDto }
// DELETE /api/collections/[id]/archive → restore → { data: WorkspaceDto }
// Archiving freezes the collection's placements and stops their public
// entries; team assets and scenes are never deleted or changed.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "collection id"), true));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "collection id"), false));
}
