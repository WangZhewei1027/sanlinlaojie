import { handleActorRoute } from "@/lib/content-model/http.server";
import { createAssetGrant, revokeAssetGrant } from "@/lib/assets/service.server";

type Context = { params: Promise<{ id: string }> };

// POST   /api/assets/[id]/workspace-grants → 410 DEPRECATED
// DELETE /api/assets/[id]/workspace-grants → 410 DEPRECATED
// Team assets are usable in every collection of the team without a grant;
// historical grants remain readable on GET /api/assets/[id] and /usage.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/workspace-grants`, async () => createAssetGrant());
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/workspace-grants`, async () => revokeAssetGrant());
}
