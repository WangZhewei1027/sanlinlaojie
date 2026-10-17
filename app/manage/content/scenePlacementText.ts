"use client";

import { useIntegrationText, type IntegrationTexts } from "@/app/manage/lib/integration-text";
import type { SceneRef } from "./types";

// Total-only wording for when the active count is unknown. Fallbacks stay
// here until locales/{zh,en}.json carry the keys.
const TEXTS: IntegrationTexts = {
  "contentModel.scene.placementsTotal": ["{{count}} 处投放", "{{count}} placements"],
  "contentModel.scene.archivePlacementsTotal": ["此场景有 {{count}} 处投放，它们不受影响。", "This scene has {{count}} placements; they are not affected."],
};

/** Placement counts for a scene, claiming an active count only when it is known. */
export function useScenePlacementText() {
  const tx = useIntegrationText(TEXTS);
  const known = (scene: Pick<SceneRef, "activePlacementCount">) => typeof scene.activePlacementCount === "number";
  return {
    summary: (scene: Required<Pick<SceneRef, "placementCount">> & Pick<SceneRef, "activePlacementCount">) => known(scene)
      ? tx("contentModel.scene.placements", { count: scene.placementCount, active: scene.activePlacementCount })
      : tx("contentModel.scene.placementsTotal", { count: scene.placementCount }),
    archive: (scene: Required<Pick<SceneRef, "placementCount">> & Pick<SceneRef, "activePlacementCount">) => known(scene)
      ? tx("contentModel.scene.archivePlacements", { count: scene.placementCount, active: scene.activePlacementCount })
      : tx("contentModel.scene.archivePlacementsTotal", { count: scene.placementCount }),
  };
}
