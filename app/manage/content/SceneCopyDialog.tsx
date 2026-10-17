"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { SceneNameDialog } from "./SceneNameDialog";
import type { ContentAction, ContentProject, SceneListItem } from "./types";

export interface SceneCopyInput {
  name: string;
  projectId: string;
}

export interface SceneCopyDialogProps {
  scene: SceneListItem | null;
  onOpenChange: (open: boolean) => void;
  sourceProjectId: string;
  /** Projects in the same organization where the viewer may create scenes. */
  targets: ContentProject[];
  /** Missing asset grants in the target come back as a conflict with impact lines. */
  onCopy: ContentAction<[sceneId: string, input: SceneCopyInput]>;
}

export function SceneCopyDialog({ scene, onOpenChange, sourceProjectId, targets, onCopy }: SceneCopyDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [projectId, setProjectId] = useState(sourceProjectId);
  const [openedFor, setOpenedFor] = useState<string | null>(scene?.id ?? null);
  if ((scene?.id ?? null) !== openedFor) {
    setOpenedFor(scene?.id ?? null);
    setProjectId(sourceProjectId);
  }
  const crossProject = projectId !== sourceProjectId;

  return (
    <SceneNameDialog
      open={!!scene}
      onOpenChange={onOpenChange}
      title={t("contentModel.scene.copyTitle")}
      description={t("contentModel.scene.copyBody")}
      submitLabel={t("contentModel.scene.copyAction")}
      initialName={scene ? t("contentModel.scene.copyDefaultName", { name: scene.name }) : ""}
      onSubmit={(name) => onCopy(scene!.id, { name, projectId })}
    >
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t("contentModel.scene.targetProject")}</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {targets.map((project) => (
              <SelectItem key={project.id} value={project.id} disabled={project.archived}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Text as="p" variant="bodyXs" tone="subdued">
          {crossProject ? t("contentModel.scene.copyCrossProjectHint") : t("contentModel.scene.copySameProjectHint")}
        </Text>
      </div>
    </SceneNameDialog>
  );
}
