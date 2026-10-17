import { MatchingError, requireUuid } from "@/lib/anchor-matching";
import { loadAssetContents, primaryResource } from "@/lib/assets/dto.server";
import { db } from "@/lib/db";
import "server-only";

export async function getMatchingAnchor(id: string) {
  requireUuid(id, "anchor_id");
  const asset = (await loadAssetContents(db, [id])).get(id);
  if (!asset || asset.file_type !== "anchor") throw new MatchingError("匹配点不存在", 404);
  return { id: asset.id, file_url: primaryResource(asset)?.url ?? null };
}
