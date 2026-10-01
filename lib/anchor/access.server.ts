import "server-only";
import { db } from "@/lib/db";
import { MatchingError, requireUuid } from "@/lib/anchor-matching";

/** Public matching endpoints validate the target asset without requiring login. */
export async function getMatchingAnchor(id: string) {
  requireUuid(id, "anchor_id");
  let asset;
  try {
    asset = await db
      .selectFrom("asset")
      .select(["id", "file_type", "file_url"])
      .where("id", "=", id)
      .executeTakeFirst();
  } catch {
    throw new MatchingError("无法查询匹配点", 503);
  }
  if (!asset || asset.file_type !== "anchor")
    throw new MatchingError("匹配点不存在", 404);
  return asset;
}

export async function validateAnchorLink(
  anchorId: unknown,
  fileType: string,
  workspaces: string[],
  assetId?: string,
) {
  if (anchorId === null || anchorId === undefined) return;
  const id = requireUuid(anchorId, "anchor_id");
  if (fileType === "anchor" || id === assetId)
    throw new MatchingError("匹配点不能挂载匹配点");
  const parent = await db
    .selectFrom("asset")
    .select(["id", "file_type", "workspace_id"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (
    !parent ||
    parent.file_type !== "anchor" ||
    !workspaces.length ||
    !workspaces.every((id) => parent.workspace_id?.includes(id))
  )
    throw new MatchingError("请选择素材所在工作空间内的匹配点");
}
