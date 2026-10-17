import { archiveAsset, getAssetDetail, updateAsset } from "@/lib/assets/service.server";
import { handleActorRoute, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { parseArchiveLock } from "@/lib/placements/service.server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}`, (actor) => getAssetDetail(actor, requireUuid(id, "asset id")));
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}`, async (actor) => updateAsset(actor, requireUuid(id, "asset id"), await readJsonBody(request)));
}
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}`, (actor) => archiveAsset(actor, requireUuid(id, "asset id"), parseArchiveLock(new URL(request.url).searchParams)));
}
