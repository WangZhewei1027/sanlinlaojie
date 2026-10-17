import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { loadActor, readableWorkspaceIds, requireOrgRead } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, handleActorRoute, hasContentModelHeader, ok, readJsonBody, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid, requireUuid } from "@/lib/content-model/input";
import { createAssetInOrganization, listOrganizationAssets, parseAssetListQuery } from "@/lib/assets/service.server";

/**
 * GET /api/organizations/[id]/assets — caller must be an org member (or super_admin).
 *   X-Content-Model: 2 → the team catalog, every same-team asset:
 *     ApiPage<AssetDto> (?view=all|shared|maintained&usable_in=&q=&file_type=&origin=&state=&limit=&offset=)
 *   otherwise → v1 projection for the "All workspaces" map: legacy rows of
 *     every collection of the organization.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: organizationId } = await params;
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    if (!isUuid(organizationId)) throw new ContentError("NOT_FOUND", "组织不存在");
    const actor = await loadActor(db, userId);
    const { searchParams } = new URL(request.url);
    if (hasContentModelHeader(request)) {
      const page = await listOrganizationAssets(actor, organizationId, parseAssetListQuery(searchParams));
      return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
    }

    const org = await requireOrgRead(db, actor, organizationId);
    const type = searchParams.get("type");
    const requireLocation = searchParams.get("requireLocation") === "true";

    const readable = await readableWorkspaceIds(db, actor, org);
    const workspaceIds =
      readable ?? (await db.selectFrom("workspace").select("id").where("organization_id", "=", organizationId).execute()).map((w) => w.id);
    if (workspaceIds.length === 0) return NextResponse.json({ data: [] });

    // asset.workspace_id 是数组，用 && 判断是否与可读项目相交；一次拉全量。
    let query = db
      .selectFrom("asset")
      .selectAll()
      .where(sql<boolean>`workspace_id && ${workspaceIds}::uuid[]`);
    if (type) query = query.where("file_type", "=", type);
    if (requireLocation) query = query.where("location", "is not", null);

    return NextResponse.json({ data: await query.execute() });
  } catch (error) {
    return failure(error, { method: "GET", path: `/api/organizations/${organizationId}/assets`, userId });
  }
}

/**
 * POST /api/organizations/[id]/assets CreateOrganizationAssetRequest (team writer)
 *   → 201 { data: CreateAssetResult } (placement null); replay → 200.
 * A team asset needs no collection; v2 by definition (no legacy POST existed here).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleActorRoute(request, `/api/organizations/${id}/assets`, async (actor) => {
    const result = await createAssetInOrganization(actor, requireUuid(id, "organization id"), await readJsonBody(request));
    return ok(result, result.created ? 201 : 200);
  });
}
