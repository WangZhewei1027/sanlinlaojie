import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { loadActor, readableWorkspaceIds, requireOrgRead } from "@/lib/content-model/access.server";
import { ContentError } from "@/lib/content-model/errors";
import { failure, hasContentModelHeader, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { listOrganizationAssets, parseAssetListQuery } from "@/lib/assets/service.server";

/**
 * GET /api/organizations/[id]/assets — caller must be an org member (or super_admin).
 *   X-Content-Model: 2 → organization catalog by real ownership and visibility:
 *     ApiPage<AssetDto> (?view=shared|maintained|all&usable_in=&q=&file_type=&origin=&state=&limit=&offset=)
 *   otherwise → v1 projection for the "All workspaces" map: legacy rows of the
 *     projects the caller can read (owner/admin: every project).
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
