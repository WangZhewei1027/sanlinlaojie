"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { ContentAction, ContentProject } from "./types";

export interface AssetGrantPickerProps {
  projects: ContentProject[];
  onGrant: ContentAction<[projectId: string]>;
}

/** Grants one more same-organization project the right to use the asset. */
export function AssetGrantPicker({ projects, onGrant }: AssetGrantPickerProps) {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState("");
  const action = useContentAction();

  const grant = async () => {
    if (projectId && (await action.run(() => onGrant(projectId)))) setProjectId("");
  };

  return (
    <div className="space-y-2 border-t px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={projectId} onValueChange={setProjectId} disabled={action.pending}>
          <SelectTrigger aria-label={t("contentModel.sharing.chooseProject")} className="w-full sm:flex-1">
            <SelectValue placeholder={t("contentModel.sharing.chooseProject")} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id} disabled={project.archived}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={grant} disabled={!projectId || action.pending}>
          {action.pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("contentModel.sharing.grant")}
        </Button>
      </div>
      {action.failure && <ContentFailureNotice failure={action.failure} />}
    </div>
  );
}
