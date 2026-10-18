import "server-only";
import type { AssetFileType, AssetContentDto, SceneResolvedResourceDto } from "@/lib/content-model/contracts";
import type { Executor } from "@/lib/content-model/tx.server";
import { loadAssetContents } from "@/lib/assets/dto.server";
import type { SceneDocument } from "@/lib/scene/protocol";
import { loadSceneForPlayback } from "@/lib/scene/service.server";

/** A placement resolves a live asset or a saved scene with live asset references. */
export type StaticPlacementTarget =
  | { kind: "asset"; assetId: string }
  | { kind: "scene"; sceneId: string };

export type ResolvedPlacementContent =
  | { kind: "asset"; fileType: AssetFileType; asset: AssetContentDto }
  | { kind: "scene"; sceneId: string; document: SceneDocument; resources: SceneResolvedResourceDto[] };

export async function resolvePlacementContent(exec: Executor, target: StaticPlacementTarget): Promise<ResolvedPlacementContent | null> {
  if (target.kind === "asset") {
    const asset = (await loadAssetContents(exec, [target.assetId])).get(target.assetId);
    if (!asset) return null;
    return { kind: "asset", fileType: asset.file_type, asset };
  }
  const playback = await loadSceneForPlayback(exec, target.sceneId);
  if (!playback) return null;
  return {
    kind: "scene",
    sceneId: playback.scene.id,
    document: playback.scene.document as unknown as SceneDocument,
    resources: playback.resources,
  };
}
