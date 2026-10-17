import "server-only";
import type { AssetFileType, AssetVersionDto, SceneResolvedResourceDto } from "@/lib/content-model/contracts";
import type { Executor } from "@/lib/content-model/tx.server";
import { asFileType, loadVersionDtos } from "@/lib/assets/dto.server";
import type { SceneDocumentV3 } from "@/lib/scene/protocol";
import { loadRevisionForPlayback } from "@/lib/scene/service.server";

/**
 * Content-resolution boundary for placements (plan §11). The first phase has
 * exactly two static targets, both fixed: an AssetVersion or a SceneRevision.
 * A future activity adds its own typed branch with a real foreign key here —
 * never a free `target_type + target_id` pair, and never via Asset.file_type.
 */
export type StaticPlacementTarget =
  | { kind: "asset_version"; assetVersionId: string }
  | { kind: "scene_revision"; sceneRevisionId: string };

export type ResolvedPlacementContent =
  | { kind: "asset_version"; fileType: AssetFileType; version: AssetVersionDto }
  | { kind: "scene_revision"; sceneRevisionId: string; sceneId: string; document: SceneDocumentV3; resources: SceneResolvedResourceDto[] };

export async function resolvePlacementContent(exec: Executor, target: StaticPlacementTarget): Promise<ResolvedPlacementContent | null> {
  if (target.kind === "asset_version") {
    const version = (await loadVersionDtos(exec, [target.assetVersionId])).get(target.assetVersionId);
    if (!version) return null;
    const asset = await exec.selectFrom("asset").select("file_type").where("id", "=", version.asset_id).executeTakeFirst();
    return { kind: "asset_version", fileType: asFileType(asset?.file_type ?? version.payload.kind), version };
  }
  const playback = await loadRevisionForPlayback(exec, target.sceneRevisionId);
  if (!playback) return null;
  return {
    kind: "scene_revision",
    sceneRevisionId: playback.revision.id,
    sceneId: playback.revision.scene_id,
    document: playback.revision.document as unknown as SceneDocumentV3,
    resources: playback.resources,
  };
}
