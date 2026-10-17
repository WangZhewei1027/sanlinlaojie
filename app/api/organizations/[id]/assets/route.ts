import { createAssetInOrganization, listOrganizationAssets, parseAssetListQuery } from "@/lib/assets/service.server";
import { loadActor } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, handleActorRoute, ok, readJsonBody, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid, requireUuid } from "@/lib/content-model/input";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/organizations/[id]/assets — caller must be an org member (or super_admin).
 *   Team catalog, every same-team asset:
 *     ApiPage<AssetDto> (?view=all|shared|maintained&usable_in=&q=&file_type=&origin=&state=&limit=&offset=)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    if (!isUuid(organizationId)) throw new ContentError("NOT_FOUND", "组织不存在");
    const actor = await loadActor(db, userId);
    const { searchParams } = new URL(request.url);
    const page = await listOrganizationAssets(actor, organizationId, parseAssetListQuery(searchParams));
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, { method: "GET", path: `/api/organizations/${organizationId}/assets`, userId });
  }
}

/**
 * POST /api/organizations/[id]/assets CreateOrganizationAssetRequest (team writer)
 *   → 201 { data: CreateAssetResult } (placement null); replay → 200.
 * A team asset needs no collection.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleActorRoute(request, `/api/organizations/${id}/assets`, async (actor) => {
    const result = await createAssetInOrganization(actor, requireUuid(id, "organization id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
