"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentErrorState, ContentListSkeleton } from "./ContentFeedback";
import { LIBRARY_GRID, LibraryGridSkeleton } from "./LibraryCard";
import { WorkbenchCard } from "./WorkbenchCard";
import type { SceneItemActions } from "./WorkbenchItemParts";
import { WORKBENCH_ROW_GRID, WorkbenchRow } from "./WorkbenchRow";
import type { ContentLoadStatus, WorkbenchItem, WorkbenchView } from "./types";

export interface WorkbenchItemsProps {
  view: WorkbenchView;
  status: ContentLoadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  items: WorkbenchItem[];
  getItemHref: (item: WorkbenchItem) => string;
  actions?: SceneItemActions;
  busyId?: string | null;
  /** Rendered when the list is ready and empty. */
  empty: ReactNode;
}

/** Grid or list of team content with matching loading, error and empty regions. */
export function WorkbenchItems({ view, status, errorMessage, onRetry, items, getItemHref, actions, busyId, empty }: WorkbenchItemsProps) {
  const { t } = useTranslation();
  const label = t("contentModel.workbench.listLabel");

  if (status === "loading") {
    return view === "grid" ? (
      <LibraryGridSkeleton label={t("contentModel.state.loading")} />
    ) : (
      <div className="overflow-hidden rounded-lg border bg-background">
        <ContentListSkeleton label={t("contentModel.state.loading")} />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        <ContentErrorState headingAs="h2" message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }
  if (items.length === 0) return <div className="rounded-lg border border-dashed bg-background">{empty}</div>;

  if (view === "grid") {
    return (
      <ul aria-label={label} className={LIBRARY_GRID}>
        {items.map((item) => (
          <WorkbenchCard key={`${item.kind}:${item.id}`} item={item} href={getItemHref(item)} actions={actions} busy={busyId === item.id} />
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div aria-hidden className={`hidden border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground ${WORKBENCH_ROW_GRID}`}>
        <span>{t("contentModel.workbench.column.name")}</span>
        <span>{t("contentModel.workbench.column.type")}</span>
        <span>{t("contentModel.workbench.column.status")}</span>
        <span>{t("contentModel.workbench.column.updated")}</span>
        <span />
      </div>
      <ul aria-label={label} className="divide-y">
        {items.map((item) => (
          <WorkbenchRow key={`${item.kind}:${item.id}`} item={item} href={getItemHref(item)} actions={actions} busy={busyId === item.id} />
        ))}
      </ul>
    </div>
  );
}
