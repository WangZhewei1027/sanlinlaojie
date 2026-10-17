import type { AssetState, ModelAnimationInfo } from "@/lib/content-model/contracts";

export interface ModelAsset { id: string; name: string | null; file_url: string | null }
export interface SceneEditorAsset { id: string; name: string | null; text_content: string; scene_revision: string }
export type ClipInfo = { name: string; duration: number };
/** `v2`: standalone scene (`/api/scenes/[id]`); `legacy`: asset-backed scene of a legacy organization. */
export type SceneMode = "legacy" | "v2";
/** A model the editor can render, resolved by pinned version (v2) or by asset (legacy). */
export interface SceneResource {
  assetId: string;
  assetVersionId: string | null;
  name: string | null;
  url: string | null;
  versionNo: number | null;
  currentVersionId: string | null;
  currentVersionNo: number | null;
  upgradeAvailable: boolean;
  assetState: AssetState;
  animations?: ModelAnimationInfo[];
}
