import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { createAssetGrant, revokeAssetGrant } from "@/lib/assets/service.server";

type Context = { params: Promise<{ id: string }> };

// POST   /api/assets/[id]/workspace-grants { workspaceId } → 201 { data: AssetGrantDto }
// DELETE /api/assets/[id]/workspace-grants?workspace_id=… → { data: { revoked: true } } | 409 DEPENDENCY_CONFLICT
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/workspace-grants`, async (actor) => createAssetGrant(actor, requireUuid(id, "asset id"), await readJsonBody(request)), 201);
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/workspace-grants`, (actor) =>
    revokeAssetGrant(actor, requireUuid(id, "asset id"), requireUuid(new URL(request.url).searchParams.get("workspace_id"), "workspace_id")),
  );
}
