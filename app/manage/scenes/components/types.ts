import type { AssetState, ModelAnimationInfo } from "@/lib/content-model/contracts";

export type ClipInfo = { name: string; duration: number };
/** A model the editor can render, resolved by pinned version. */
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
