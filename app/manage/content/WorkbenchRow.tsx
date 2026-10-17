"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useContentFormat } from "./useContentFormat";
import { WorkbenchBadges, WorkbenchItemMenu, WorkbenchThumbnail, workbenchTypeKey, type SceneItemActions } from "./WorkbenchItemParts";
import type { WorkbenchItem } from "./types";

/** Desktop column template shared by the list header and every row. */
export const WORKBENCH_ROW_GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_7rem_11rem_7.5rem_2.5rem] lg:items-center lg:gap-4";

export interface WorkbenchRowProps {
  item: WorkbenchItem;
  href: string;
  actions?: SceneItemActions;
  busy?: boolean;
}

/** Dense list row for scanning many items; narrow screens stack the metadata. */
export function WorkbenchRow({ item, href, actions = {}, busy }: WorkbenchRowProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const type = t(workbenchTypeKey(item.type));
  const date = format.date(item.updatedAt);
  return (
    <li className={`relative flex items-center gap-3 px-3 py-2.5 transition-colors focus-within:bg-muted/50 hover:bg-muted/50 ${WORKBENCH_ROW_GRID}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
          <WorkbenchThumbnail item={item} iconClassName="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={href}
            title={item.name}
            className="block truncate rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']"
          >
            {item.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground lg:hidden">{type} · {date}</p>
          <div className="lg:hidden"><WorkbenchBadges item={item} /></div>
        </div>
      </div>
      <Cell label={t("contentModel.workbench.column.type")}><span className="text-sm">{type}</span></Cell>
      <Cell label={t("contentModel.workbench.column.status")}><WorkbenchBadges item={item} /></Cell>
      <Cell label={t("contentModel.workbench.column.updated")}>
        <time dateTime={item.updatedAt} className="text-sm tabular-nums text-muted-foreground">{date}</time>
      </Cell>
      <div className="relative z-10 flex shrink-0 justify-end">
        <WorkbenchItemMenu item={item} actions={actions} busy={busy} />
      </div>
    </li>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative hidden min-w-0 lg:block">
      <span className="sr-only">{label}: </span>
      {children}
    </div>
  );
}
