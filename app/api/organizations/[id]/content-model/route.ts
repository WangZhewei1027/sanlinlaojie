import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getContentModelState, setContentModelState } from "@/lib/content-model/projects.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/organizations/[id]/content-model → { data: OrganizationContentModelDto }
// PUT /api/organizations/[id]/content-model SetContentModelStateRequest (super_admin) → { data: OrganizationContentModelDto }
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/organizations/${id}/content-model`, (actor) => getContentModelState(actor, requireUuid(id, "organization id")));
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/organizations/${id}/content-model`, async (actor) => setContentModelState(actor, requireUuid(id, "organization id"), await readJsonBody(request)));
}
