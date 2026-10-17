"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentContextLine } from "./ContentContextLine";
import { ContentEmptyState, ContentErrorState, ContentFailureNotice, ContentListSkeleton, ContentNotice } from "./ContentFeedback";
import { SceneArchiveDialog } from "./SceneArchiveDialog";
import { SceneCopyDialog, type SceneCopyInput } from "./SceneCopyDialog";
import { SCENE_ROW_GRID, SceneListRow } from "./SceneListRow";
import { SceneListToolbar } from "./SceneListToolbar";
import { SceneNameDialog } from "./SceneNameDialog";
import type { ContentActionFailure } from "./useContentAction";
import {
  DEFAULT_SCENE_FILTERS,
  type ContentAction,
  type ContentLoadStatus,
  type ContentProject,
  type ProjectRole,
  type SceneListFilters,
  type SceneListItem,
} from "./types";

export interface SceneListProps {
  organizationName: string;
  /** Scenes always belong to one real project; null asks the user to choose one. */
  project: ContentProject | null;
  role?: ProjectRole | null;
  /** Project editor or manager with a writable organization role. */
  canEdit: boolean;
  filters: SceneListFilters;
  onFiltersChange: (filters: SceneListFilters) => void;
  status: ContentLoadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  scenes: SceneListItem[];
  getSceneHref?: (sceneId: string) => string;
  onOpenScene?: (sceneId: string) => void;
  /** Resolve after the scene exists; the page usually navigates to the editor. */
  onCreate: ContentAction<[name: string]>;
  /** Secondary JSON import, shown only when provided. */
  onImport?: () => void;
  copyTargets: ContentProject[];
  onCopy: ContentAction<[sceneId: string, input: SceneCopyInput]>;
  onArchive: ContentAction<[sceneId: string]>;
  onRestore: ContentAction<[sceneId: string]>;
}

export function SceneList(props: SceneListProps) {
  const { t } = useTranslation();
  const { project, scenes, status, filters } = props;
  const [createOpen, setCreateOpen] = useState(false);
  const [copying, setCopying] = useState<SceneListItem | null>(null);
  const [archiving, setArchiving] = useState<SceneListItem | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [failure, setFailure] = useState<ContentActionFailure | null>(null);
  const writable = !!project && !project.archived && props.canEdit;
  const createReason = !project
    ? t("contentModel.scene.needsProject")
    : project.archived
      ? t("contentModel.library.projectArchived")
      : !props.canEdit
        ? t("contentModel.scene.noPermission")
        : undefined;
  const filtered = Boolean(filters.query) || filters.status !== "current";

  const restore = async (scene: SceneListItem) => {
    setRestoring(scene.id);
    setFailure(null);
    try {
      const result = await props.onRestore(scene.id);
      if (result && !result.ok) setFailure(result);
    } catch (error) {
      setFailure({ ok: false, kind: "error", message: error instanceof Error ? error.message : undefined });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label={t("contentModel.scene.title")}>
      <ContentContextLine organizationName={props.organizationName} project={project} role={props.role} />
      <SceneListToolbar
        filters={filters}
        onFiltersChange={props.onFiltersChange}
        canCreate={writable}
        createUnavailableReason={createReason}
        onCreate={() => setCreateOpen(true)}
        onImport={writable ? props.onImport : undefined}
      />
      {project?.archived && <ContentNotice title={t("contentModel.scene.projectArchivedTitle")} description={t("contentModel.scene.projectArchivedBody")} />}
      {failure && <ContentFailureNotice failure={failure} />}

      <div className="overflow-hidden rounded-lg border bg-background">
        <div aria-hidden className={`hidden border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground ${SCENE_ROW_GRID}`}>
          <span>{t("contentModel.scene.column.scene")}</span>
          <span>{t("contentModel.scene.column.placements")}</span>
          <span>{t("contentModel.scene.column.updated")}</span>
          <span />
        </div>
        {!project ? (
          <ContentEmptyState headingAs="h2" title={t("contentModel.scene.empty.noProjectTitle")} description={t("contentModel.scene.empty.noProjectBody")} />
        ) : status === "loading" ? (
          <ContentListSkeleton label={t("contentModel.state.loading")} />
        ) : status === "error" ? (
          <ContentErrorState headingAs="h2" message={props.errorMessage} onRetry={props.onRetry} />
        ) : scenes.length === 0 ? (
          filtered ? (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.scene.empty.filteredTitle")}
              description={t("contentModel.scene.empty.filteredBody")}
              actions={<Button variant="outline" size="sm" onClick={() => props.onFiltersChange({ ...DEFAULT_SCENE_FILTERS })}>{t("contentModel.action.clearFilters")}</Button>}
            />
          ) : (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.scene.empty.projectTitle")}
              description={writable ? t("contentModel.scene.empty.projectBody") : t("contentModel.scene.empty.readOnlyBody")}
            />
          )
        ) : (
          <ul className="divide-y" aria-label={t("contentModel.scene.title")}>
            {scenes.map((scene) => {
              const archived = scene.status === "archived";
              return (
                <SceneListRow
                  key={scene.id}
                  scene={scene}
                  href={props.getSceneHref?.(scene.id)}
                  onOpen={props.onOpenScene}
                  onCopy={writable && !archived ? setCopying : undefined}
                  onArchive={writable && !archived ? setArchiving : undefined}
                  onRestore={writable && archived ? restore : undefined}
                  busy={restoring === scene.id}
                />
              );
            })}
          </ul>
        )}
      </div>
      {project && status === "ready" && scenes.length > 0 && (
        <Text as="p" variant="bodyXs" tone="subdued" aria-live="polite">{t("contentModel.scene.count", { count: scenes.length })}</Text>
      )}

      <SceneNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("contentModel.scene.createTitle")}
        description={t("contentModel.scene.createBody", { project: project?.name ?? "" })}
        submitLabel={t("contentModel.scene.createAction")}
        onSubmit={props.onCreate}
      />
      <SceneCopyDialog
        scene={copying}
        onOpenChange={(open) => { if (!open) setCopying(null); }}
        sourceProjectId={project?.id ?? ""}
        targets={props.copyTargets}
        onCopy={props.onCopy}
      />
      <SceneArchiveDialog scene={archiving} onOpenChange={(open) => { if (!open) setArchiving(null); }} onArchive={props.onArchive} />
    </section>
  );
}
