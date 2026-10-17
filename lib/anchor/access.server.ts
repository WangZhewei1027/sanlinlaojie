import { MatchingError, requireUuid } from "@/lib/anchor-matching";
import { loadVersionDtos, primaryResource } from "@/lib/assets/dto.server";
import { db } from "@/lib/db";
import "server-only";

export async function getMatchingAnchor(id: string, versionId: string) {
  requireUuid(id, "anchor_id");
  requireUuid(versionId, "version_id");
  const asset = await db.selectFrom("asset").select(["id", "file_type", "current_version_id"]).where("id", "=", id).executeTakeFirst();
  if (!asset || asset.file_type !== "anchor" || !asset.current_version_id) throw new MatchingError("匹配点不存在", 404);
  const version = (await loadVersionDtos(db, [versionId])).get(versionId);
  if (!version || version.asset_id !== id) throw new MatchingError("匹配图版本不存在", 404);
  return { id: asset.id, version_id: versionId, file_url: primaryResource(version)?.url ?? null };
}
