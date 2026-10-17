import { listWorkspaceAssets, parseAssetListQuery } from "@/lib/assets/service.server";
import { handleActorRoute } from "@/lib/content-model/http.server";
import { requireUuid } from "@/lib/content-model/input";
import { NextResponse } from "next/server";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleActorRoute(request, `/api/collections/${id}/assets`, async (actor) =>
    NextResponse.json(await listWorkspaceAssets(actor, requireUuid(id, "collection id"), parseAssetListQuery(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } }));
}
