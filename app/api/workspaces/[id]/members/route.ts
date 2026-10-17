import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { listWorkspaceMembers, putWorkspaceMember, removeWorkspaceMember } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// GET    /api/workspaces/[id]/members → { data: WorkspaceMembersDto } (read-only: every team member, implicit)
// PUT    /api/workspaces/[id]/members → 410 DEPRECATED (collections have no membership)
// DELETE /api/workspaces/[id]/members → 410 DEPRECATED
// Access to every collection comes from the team role (organization_member).
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, (actor) => listWorkspaceMembers(actor, requireUuid(id, "workspace id")));
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, async () => putWorkspaceMember());
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/workspaces/${id}/members`, async () => removeWorkspaceMember());
}
