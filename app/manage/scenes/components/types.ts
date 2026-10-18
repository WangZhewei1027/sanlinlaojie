import type { AssetState, ModelAnimationInfo } from "@/lib/content-model/contracts";

export type ClipInfo = { name: string; duration: number };
/** A model the editor can render, resolved from the current asset. */
export interface SceneResource {
  assetId: string;
  assetLockVersion: number;
  name: string | null;
  url: string | null;
  assetState: AssetState;
  animations?: ModelAnimationInfo[];
}
