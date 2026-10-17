import { handleActorRoute, ok, readJsonBody } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { duplicateAsset } from "@/lib/assets/service.server";

type Context = { params: Promise<{ id: string }> };

// POST /api/assets/[id]/duplicate DuplicateAssetRequest → { data: CreateAssetResult } (201 new, 200 replay)
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handleActorRoute(request, `/api/assets/${id}/duplicate`, async (actor) => {
    const result = await duplicateAsset(actor, requireUuid(id, "asset id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
