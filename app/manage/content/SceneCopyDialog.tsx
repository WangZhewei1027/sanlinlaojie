"use client";

import { useTranslation } from "react-i18next";
import { SceneNameDialog } from "./SceneNameDialog";
import type { ContentAction, SceneRef } from "./types";

export interface SceneCopyDialogProps {
  scene: SceneRef | null;
  onOpenChange: (open: boolean) => void;
  /** Creates a same-team copy with its own draft; the page opens it or refreshes. */
  onCopy: ContentAction<[sceneId: string, name: string]>;
}

/** Copies a scene inside the team. The copy pins the same asset versions and has no revisions or placements. */
export function SceneCopyDialog({ scene, onOpenChange, onCopy }: SceneCopyDialogProps) {
  const { t } = useTranslation();
  return (
    <SceneNameDialog
      open={!!scene}
      onOpenChange={onOpenChange}
      title={t("contentModel.scene.copyTitle")}
      description={t("contentModel.scene.copyBody")}
      submitLabel={t("contentModel.scene.copyAction")}
      initialName={scene ? t("contentModel.scene.copyDefaultName", { name: scene.name }) : ""}
      onSubmit={(name) => onCopy(scene!.id, name)}
    />
  );
}
