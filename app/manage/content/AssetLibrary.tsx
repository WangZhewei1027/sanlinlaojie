"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ASSET_ROW_GRID, AssetLibraryRow } from "./AssetLibraryRow";
import { AssetLibraryToolbar, hasActiveAssetFilters } from "./AssetLibraryToolbar";
import { ContentContextLine } from "./ContentContextLine";
import { ContentEmptyState, ContentErrorState, ContentFailureNotice, ContentListSkeleton } from "./ContentFeedback";
import type { ContentActionFailure } from "./useContentAction";
import {
  DEFAULT_ASSET_FILTERS,
  type AssetLibraryFilters,
  type AssetLibraryItem,
  type AssetLibraryScope,
  type ContentAction,
  type ContentLoadStatus,
  type ContentProject,
  type ProjectRole,
} from "./types";

export interface AssetLibraryProps {
  organizationName: string;
  /** The real project uploads and grants target; null in the aggregate view. */
  project: ContentProject | null;
  role?: ProjectRole | null;
  scope: AssetLibraryScope;
  onScopeChange: (scope: AssetLibraryScope) => void;
  filters: AssetLibraryFilters;
  onFiltersChange: (filters: AssetLibraryFilters) => void;
  status: ContentLoadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  items: AssetLibraryItem[];
  /** Server-side total for the current filters, when known. */
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Permission to upload into `project`; archive and project presence are checked here. */
  canUpload: boolean;
  onUpload: () => void;
  /** Permission to grant organization assets to `project`. */
  canAddToProject: boolean;
  onAddToProject?: ContentAction<[assetId: string]>;
  getAssetHref?: (assetId: string) => string;
  onOpenAsset?: (assetId: string) => void;
}

export function AssetLibrary(props: AssetLibraryProps) {
  const { t } = useTranslation();
  const { project, scope, filters, status, items } = props;
  const [adding, setAdding] = useState<string[]>([]);
  const [failure, setFailure] = useState<ContentActionFailure | null>(null);

  const writable = !!project && !project.archived;
  const uploadReason = !project
    ? t("contentModel.library.uploadNeedsProject")
    : project.archived
      ? t("contentModel.library.projectArchived")
      : !props.canUpload
        ? t("contentModel.library.uploadNoPermission")
        : undefined;
  const canAdd = writable && props.canAddToProject && !!props.onAddToProject;

  const addToProject = async (assetId: string) => {
    if (!props.onAddToProject) return;
    setAdding((ids) => [...ids, assetId]);
    setFailure(null);
    try {
      const result = await props.onAddToProject(assetId);
      if (result && !result.ok) setFailure(result);
    } catch (error) {
      setFailure({ ok: false, kind: "error", message: error instanceof Error ? error.message : undefined });
    } finally {
      setAdding((ids) => ids.filter((id) => id !== assetId));
    }
  };

  const filtered = hasActiveAssetFilters(filters);
  const clearFilters = () => props.onFiltersChange({ ...DEFAULT_ASSET_FILTERS });

  return (
    <section className="flex flex-col gap-4" aria-label={t("contentModel.library.title")}>
      <ContentContextLine organizationName={props.organizationName} project={project} role={props.role} />
      <AssetLibraryToolbar
        scope={scope}
        onScopeChange={props.onScopeChange}
        filters={filters}
        onFiltersChange={props.onFiltersChange}
        canUpload={writable && props.canUpload}
        uploadUnavailableReason={uploadReason}
        onUpload={props.onUpload}
      />
      {failure && <ContentFailureNotice failure={failure} />}

      <div className="overflow-hidden rounded-lg border bg-background">
        <div aria-hidden className={`hidden border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground ${ASSET_ROW_GRID}`}>
          <span>{t("contentModel.library.column.asset")}</span>
          <span>{t("contentModel.library.column.maintainer")}</span>
          <span>{t("contentModel.library.column.version")}</span>
          <span>{t("contentModel.library.column.usage")}</span>
          <span>{t("contentModel.library.column.updated")}</span>
          <span />
        </div>

        {status === "loading" && <ContentListSkeleton label={t("contentModel.state.loading")} />}
        {status === "error" && <ContentErrorState headingAs="h2" message={props.errorMessage} onRetry={props.onRetry} />}
        {status === "ready" && items.length === 0 && (
          filtered ? (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.library.empty.filteredTitle")}
              description={t("contentModel.library.empty.filteredBody")}
              actions={<Button variant="outline" size="sm" onClick={clearFilters}>{t("contentModel.action.clearFilters")}</Button>}
            />
          ) : scope === "project" && !project ? (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.library.empty.noProjectTitle")}
              description={t("contentModel.library.empty.noProjectBody")}
              actions={<Button variant="outline" size="sm" onClick={() => props.onScopeChange("organization")}>{t("contentModel.library.browseShared")}</Button>}
            />
          ) : scope === "project" ? (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.library.empty.projectTitle")}
              description={t("contentModel.library.empty.projectBody")}
              actions={<Button variant="outline" size="sm" onClick={() => props.onScopeChange("organization")}>{t("contentModel.library.browseShared")}</Button>}
            />
          ) : (
            <ContentEmptyState headingAs="h2" title={t("contentModel.library.empty.sharedTitle")} description={t("contentModel.library.empty.sharedBody")} />
          )
        )}
        {status === "ready" && items.length > 0 && (
          <ul className="divide-y" aria-label={t(`contentModel.library.scope.${scope}`)}>
            {items.map((asset) => (
              <AssetLibraryRow
                key={asset.id}
                asset={asset}
                scope={scope}
                href={props.getAssetHref?.(asset.id)}
                onOpen={props.onOpenAsset}
                onAddToProject={canAdd ? addToProject : undefined}
                adding={adding.includes(asset.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {status === "ready" && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text as="p" variant="bodyXs" tone="subdued" aria-live="polite">
            {t("contentModel.library.shown", { shown: items.length, total: props.totalCount ?? items.length })}
          </Text>
          {props.hasMore && props.onLoadMore && (
            <Button variant="outline" size="sm" onClick={props.onLoadMore} disabled={props.loadingMore}>
              {props.loadingMore ? t("contentModel.state.loading") : t("contentModel.action.loadMore")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
