import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { getAssetUsage } from "@/lib/assets/service.server";

type Context = { params: Promise<{ id: string }> };

// GET /api/assets/[id]/usage → { data: AssetUsageDto } (names only for readable projects)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/usage`, (actor) => getAssetUsage(actor, requireUuid(id, "asset id")));
}
