"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import { useScenePlacementText } from "./scenePlacementText";
import type { ContentAction, SceneRef } from "./types";

export interface SceneArchiveDialogProps {
  scene: SceneRef | null;
  onOpenChange: (open: boolean) => void;
  onArchive: ContentAction<[sceneId: string]>;
}

/** Archive keeps existing placements playing the saved scene. */
export function SceneArchiveDialog({ scene, onOpenChange, onArchive }: SceneArchiveDialogProps) {
  const { t } = useTranslation();
  const placementText = useScenePlacementText();
  const action = useContentAction();
  // Keep the last scene so the title stays filled while the dialog animates closed.
  const [shown, setShown] = useState(scene);
  if (scene && scene !== shown) setShown(scene);
  const close = (next: boolean) => {
    if (action.pending) return;
    if (!next) action.reset();
    onOpenChange(next);
  };
  const submit = async () => {
    if (scene && (await action.run(() => onArchive(scene.id)))) close(false);
  };

  return (
    <Dialog open={!!scene} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contentModel.scene.archiveTitle", { name: shown?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("contentModel.scene.archiveBody")}</DialogDescription>
        </DialogHeader>
        {!!shown?.placementCount && (
          <Text as="p" variant="bodySm">{placementText.archive({ placementCount: shown.placementCount, activePlacementCount: shown.activePlacementCount })}</Text>
        )}
        {action.failure && <ContentFailureNotice failure={action.failure} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("contentModel.scene.archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
