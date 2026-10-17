import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { setWorkspaceArchived } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// POST   /api/workspaces/[id]/archive → archive the project → { data: WorkspaceDto }
// DELETE /api/workspaces/[id]/archive → restore → { data: WorkspaceDto }
// Archived projects are read-only and stop every public entry of their own placements.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "workspace id"), true));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/archive`, (actor) => setWorkspaceArchived(actor, requireUuid(id, "workspace id"), false));
}
