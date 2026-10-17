import type { AssetState, ModelAnimationInfo } from "@/lib/content-model/contracts";

export type ClipInfo = { name: string; duration: number };
/** A model the editor can render, resolved by pinned version. */
export interface SceneResource {
  assetId: string;
  assetLockVersion: number;
  name: string | null;
  url: string | null;
  assetState: AssetState;
  animations?: ModelAnimationInfo[];
}
