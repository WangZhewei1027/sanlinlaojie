"use client";

import { useTranslation } from "react-i18next";
import { Clapperboard, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentEmptyState } from "./ContentFeedback";
import type { WorkbenchFilters } from "./types";

/** Empty region that names the next step for the current filter. */
export function WorkbenchEmpty({ filters, canWrite, canUpload, onClear, onUpload, onCreateScene }: {
  filters: WorkbenchFilters; canWrite: boolean; canUpload: boolean; onClear: () => void; onUpload: () => void; onCreateScene: () => void;
}) {
  const { t } = useTranslation();
  const clear = <Button variant="outline" size="sm" onClick={onClear}>{t("contentModel.action.clearFilters")}</Button>;
  if (filters.query.trim()) {
    return <ContentEmptyState headingAs="h2" title={t("contentModel.workbench.empty.filteredTitle")} description={t("contentModel.workbench.empty.filteredBody")} actions={clear} />;
  }
  if (filters.state === "archived") {
    return <ContentEmptyState headingAs="h2" title={t("contentModel.workbench.empty.archivedTitle")} description={t("contentModel.workbench.empty.archivedBody")} actions={clear} />;
  }
  if (filters.type === "scene") {
    return (
      <ContentEmptyState
        headingAs="h2"
        title={t("contentModel.workbench.empty.sceneTitle")}
        description={t(canWrite ? "contentModel.workbench.empty.sceneBody" : "contentModel.workbench.empty.viewerBody")}
        actions={canWrite && <Button size="sm" onClick={onCreateScene}>{t("contentModel.workbench.createScene")}</Button>}
      />
    );
  }
  if (filters.type !== "all") {
    return (
      <ContentEmptyState
        headingAs="h2"
        title={t("contentModel.workbench.empty.typeTitle", { type: t(`contentModel.workbench.types.${filters.type}`) })}
        description={t(canUpload ? "contentModel.workbench.empty.assetBody" : "contentModel.workbench.empty.viewerBody")}
        actions={canUpload ? <Button size="sm" onClick={onUpload}>{t("contentModel.workbench.upload")}</Button> : clear}
      />
    );
  }
  return (
    <ContentEmptyState
      headingAs="h2"
      title={t("contentModel.workbench.empty.teamTitle")}
      description={t(canWrite ? "contentModel.workbench.empty.teamBody" : "contentModel.workbench.empty.viewerBody")}
      actions={canWrite && (
        <>
          {canUpload && <Button size="sm" onClick={onUpload}><Upload aria-hidden />{t("contentModel.workbench.upload")}</Button>}
          <Button size="sm" variant="outline" onClick={onCreateScene}><Clapperboard aria-hidden />{t("contentModel.workbench.createScene")}</Button>
        </>
      )}
    />
  );
}
