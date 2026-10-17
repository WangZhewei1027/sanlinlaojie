import "server-only";
import type { AssetFileType, AssetContentDto, SceneResolvedResourceDto } from "@/lib/content-model/contracts";
import type { Executor } from "@/lib/content-model/tx.server";
import { loadAssetContents } from "@/lib/assets/dto.server";
import type { SceneDocument } from "@/lib/scene/protocol";
import { loadRevisionForPlayback } from "@/lib/scene/service.server";

/** A placement resolves a live asset or a published scene layout with live asset references. */
export type StaticPlacementTarget =
  | { kind: "asset"; assetId: string }
  | { kind: "scene_revision"; sceneRevisionId: string };

export type ResolvedPlacementContent =
  | { kind: "asset"; fileType: AssetFileType; asset: AssetContentDto }
  | { kind: "scene_revision"; sceneRevisionId: string; sceneId: string; document: SceneDocument; resources: SceneResolvedResourceDto[] };

export async function resolvePlacementContent(exec: Executor, target: StaticPlacementTarget): Promise<ResolvedPlacementContent | null> {
  if (target.kind === "asset") {
    const asset = (await loadAssetContents(exec, [target.assetId])).get(target.assetId);
    if (!asset) return null;
    return { kind: "asset", fileType: asset.file_type, asset };
  }
  const playback = await loadRevisionForPlayback(exec, target.sceneRevisionId);
  if (!playback) return null;
  return {
    kind: "scene_revision",
    sceneRevisionId: playback.revision.id,
    sceneId: playback.revision.scene_id,
    document: playback.revision.document as unknown as SceneDocument,
    resources: playback.resources,
  };
}
