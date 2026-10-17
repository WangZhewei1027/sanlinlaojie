import { handleActorRoute, ok, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { createAssetVersion, getAssetDetail } from "@/lib/assets/service.server";

type Context = { params: Promise<{ id: string }> };

// GET  /api/assets/[id]/versions → { data: AssetVersionDto[] } (newest first)
// POST /api/assets/[id]/versions CreateAssetVersionRequest → { data: CreateVersionResult } (201 new, 200 replay)
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/versions`, async (actor) => (await getAssetDetail(actor, requireUuid(id, "asset id"))).versions);
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/versions`, async (actor) => {
    const result = await createAssetVersion(actor, requireUuid(id, "asset id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
