"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useContentFormat } from "./useContentFormat";
import { WORKBENCH_TYPE_ICONS, WorkbenchBadges, WorkbenchItemMenu, WorkbenchThumbnail, workbenchTypeKey, type SceneItemActions } from "./WorkbenchItemParts";
import type { WorkbenchItem } from "./types";

export interface WorkbenchCardProps {
  item: WorkbenchItem;
  href: string;
  /** Scene actions the viewer may perform; omitted entries are hidden. */
  actions?: SceneItemActions;
  busy?: boolean;
}

/**
 * Grid tile: the content's own picture leads, the name and type follow. The
 * whole tile is one link; the overflow menu sits above the link layer.
 */
export function WorkbenchCard({ item, href, actions = {}, busy }: WorkbenchCardProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const TypeIcon = WORKBENCH_TYPE_ICONS[item.type];
  return (
    <li className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring hover:border-foreground/25">
      <div className="aspect-[4/3] overflow-hidden border-b bg-muted">
        <WorkbenchThumbnail item={item} />
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-1 p-3 pe-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Link
            href={href}
            title={item.name}
            className="block truncate rounded-sm text-sm font-medium text-foreground focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
          >
            {item.name}
          </Link>
          {/* Type and date each stay whole; on narrow tiles the date wraps under the type. */}
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <TypeIcon className="size-3.5 shrink-0" aria-hidden />
              {t(workbenchTypeKey(item.type))}
            </span>
            <time dateTime={item.updatedAt} className="whitespace-nowrap tabular-nums">{format.date(item.updatedAt)}</time>
          </p>
          <WorkbenchBadges item={item} />
        </div>
        <div className="relative z-10 -mt-1 shrink-0">
          <WorkbenchItemMenu item={item} actions={actions} busy={busy} />
        </div>
      </div>
    </li>
  );
}
