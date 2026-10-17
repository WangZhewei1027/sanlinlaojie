"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Eye, FileJson, MoreHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "./ContentFeedback";
import { SceneArchiveDialog } from "./SceneArchiveDialog";
import { SceneCopyDialog } from "./SceneCopyDialog";
import { SceneNameDialog } from "./SceneNameDialog";
import type { ContentActionFailure } from "./useContentAction";
import { WorkbenchItems } from "./WorkbenchItems";
import { WorkbenchEmpty } from "./WorkbenchEmpty";
import { WorkbenchToolbar } from "./WorkbenchToolbar";
import {
  DEFAULT_WORKBENCH_FILTERS,
  type ContentAction,
  type ContentLoadStatus,
  type SceneRef,
  type TeamSummary,
  type WorkbenchFilters,
  type WorkbenchItem,
  type WorkbenchView,
} from "./types";

export interface ContentWorkbenchProps {
  team: TeamSummary;
  filters: WorkbenchFilters;
  onFiltersChange: (filters: WorkbenchFilters) => void;
  view: WorkbenchView;
  onViewChange: (view: WorkbenchView) => void;
  status: ContentLoadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  items: WorkbenchItem[];
  /** Total for the current filters, when known. */
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  getItemHref: (item: WorkbenchItem) => string;
  /** Team-level write access. False shows the read-only explanation instead of create actions. */
  canWrite: boolean;
  /** Why the page is read-only (viewer role, migration freeze). */
  readOnlyReason?: string;
  /** Upload is offered only when the team allows at least one uploadable type. */
  canUpload?: boolean;
  onUpload: () => void;
  /** Resolves after the scene exists; the page usually opens the editor. */
  onCreateScene: ContentAction<[name: string]>;
  onImportScene?: () => void;
  onCopyScene: ContentAction<[sceneId: string, name: string]>;
  onArchiveScene: ContentAction<[sceneId: string]>;
  onRestoreScene: ContentAction<[sceneId: string]>;
  /** Page-level banners (migration state, refresh failures) under the header. */
  notice?: ReactNode;
}

const refOf = (item: WorkbenchItem): SceneRef => ({ id: item.id, name: item.name, placementCount: item.placementCount, activePlacementCount: item.activePlacementCount });

/**
 * The team workbench: every asset and scene of the team in one thumbnail-led
 * grid (or list), filtered by type. Creating content never asks for a
 * collection; placing it on a map happens in a map collection.
 */
export function ContentWorkbench(props: ContentWorkbenchProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const { filters, canWrite, status, items } = props;
  const [createOpen, setCreateOpen] = useState(false);
  const [copying, setCopying] = useState<SceneRef | null>(null);
  const [archiving, setArchiving] = useState<SceneRef | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [failure, setFailure] = useState<ContentActionFailure | null>(null);
  const canUpload = canWrite && props.canUpload !== false;
  const scenesFirst = filters.type === "scene";

  const restore = async (item: WorkbenchItem) => {
    setRestoring(item.id);
    setFailure(null);
    try {
      const result = await props.onRestoreScene(item.id);
      if (result && !result.ok) setFailure(result);
    } catch (error) {
      setFailure({ ok: false, kind: "error", message: error instanceof Error ? error.message : undefined });
    } finally {
      setRestoring(null);
    }
  };

  const uploadButton = (variant: "default" | "outline") => (
    <Button variant={variant} onClick={props.onUpload}><Upload aria-hidden />{t("contentModel.workbench.upload")}</Button>
  );
  const sceneButton = (variant: "default" | "outline") => (
    <Button variant={variant} onClick={() => setCreateOpen(true)}><Clapperboard aria-hidden />{t("contentModel.workbench.createScene")}</Button>
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Text as="h1" id={headingId} variant="headingLg">{t("contentModel.workbench.title")}</Text>
          <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.workbench.subtitle", { team: props.team.name })}</Text>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* One primary action per state: creating a scene while browsing scenes, uploading otherwise. */}
            {scenesFirst ? sceneButton("default") : canUpload && uploadButton("default")}
            {scenesFirst ? canUpload && uploadButton("outline") : sceneButton("outline")}
            {props.onImportScene && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("contentModel.workbench.moreCreate")}><MoreHorizontal aria-hidden /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={props.onImportScene}><FileJson aria-hidden />{t("contentModel.workbench.importScene")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : props.readOnlyReason ? (
          <p className="flex max-w-sm items-start gap-1.5 text-sm text-muted-foreground">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{props.readOnlyReason}</span>
          </p>
        ) : null}
      </header>

      {props.notice}
      <WorkbenchToolbar filters={filters} onFiltersChange={props.onFiltersChange} view={props.view} onViewChange={props.onViewChange} />
      {failure && <ContentFailureNotice failure={failure} />}

      <WorkbenchItems
        view={props.view}
        status={status}
        errorMessage={props.errorMessage}
        onRetry={props.onRetry}
        items={items}
        getItemHref={props.getItemHref}
        busyId={restoring}
        actions={canWrite ? { onCopy: (item) => setCopying(refOf(item)), onArchive: (item) => setArchiving(refOf(item)), onRestore: restore } : undefined}
        empty={<WorkbenchEmpty filters={filters} canWrite={canWrite} canUpload={canUpload} onClear={() => props.onFiltersChange({ ...DEFAULT_WORKBENCH_FILTERS })} onUpload={props.onUpload} onCreateScene={() => setCreateOpen(true)} />}
      />

      {status === "ready" && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text as="p" variant="bodyXs" tone="subdued" aria-live="polite">
            {t("contentModel.workbench.shown", { shown: items.length, total: props.totalCount ?? items.length })}
          </Text>
          {props.hasMore && props.onLoadMore && (
            <Button variant="outline" size="sm" onClick={props.onLoadMore} disabled={props.loadingMore}>
              {props.loadingMore ? t("contentModel.state.loading") : t("contentModel.action.loadMore")}
            </Button>
          )}
        </div>
      )}

      <SceneNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("contentModel.scene.createTitle")}
        description={t("contentModel.scene.createBody")}
        submitLabel={t("contentModel.scene.createAction")}
        onSubmit={props.onCreateScene}
      />
      <SceneCopyDialog scene={copying} onOpenChange={(open) => { if (!open) setCopying(null); }} onCopy={props.onCopyScene} />
      <SceneArchiveDialog scene={archiving} onOpenChange={(open) => { if (!open) setArchiving(null); }} onArchive={props.onArchiveScene} />
    </section>
  );
}
