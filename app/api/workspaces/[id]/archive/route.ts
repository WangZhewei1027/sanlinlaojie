import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { setWorkspaceArchived } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// POST   /api/workspaces/[id]/archive → archive the collection → { data: WorkspaceDto }
// DELETE /api/workspaces/[id]/archive → restore → { data: WorkspaceDto }
// Alias of /api/collections/[id]/archive (any team writer). Archived collections
// keep their placements read-only and stop their public entries; team assets
// and scenes are unaffected.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "workspace id"), true));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "workspace id"), false));
}
