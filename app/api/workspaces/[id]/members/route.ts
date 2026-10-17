import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { listWorkspaceMembers, putWorkspaceMember, removeWorkspaceMember } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// GET    /api/workspaces/[id]/members → { data: WorkspaceMembersDto }
// PUT    /api/workspaces/[id]/members { userId, role } → { data: WorkspaceMemberDto }
// DELETE /api/workspaces/[id]/members?user_id=… → { data: { removed } }
// Project managers manage editor/viewer of existing org members; manager grants need org owner/admin.
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, (actor) => listWorkspaceMembers(actor, requireUuid(id, "workspace id")));
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, async (actor) => putWorkspaceMember(actor, requireUuid(id, "workspace id"), await readJsonBody(request)));
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, (actor) =>
    removeWorkspaceMember(actor, requireUuid(id, "workspace id"), requireUuid(new URL(request.url).searchParams.get("user_id"), "user_id")),
  );
}
