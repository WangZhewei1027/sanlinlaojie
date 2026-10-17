"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, Copy, Film, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/typography";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { useContentFormat } from "./useContentFormat";
import { useScenePlacementText } from "./scenePlacementText";
import type { SceneListItem } from "./types";

export const SCENE_ROW_GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_10rem_13rem_9rem] lg:items-center lg:gap-4";

export interface SceneListRowProps {
  scene: SceneListItem;
  href?: string;
  onOpen?: (sceneId: string) => void;
  /** Present when the viewer may write in the project. */
  onCopy?: (scene: SceneListItem) => void;
  onArchive?: (scene: SceneListItem) => void;
  onRestore?: (scene: SceneListItem) => void;
  busy?: boolean;
}

export function SceneListRow({ scene, href, onOpen, onCopy, onArchive, onRestore, busy }: SceneListRowProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const placementText = useScenePlacementText();
  const archived = scene.status === "archived";
  const placements = scene.placementCount
    ? placementText.summary(scene)
    : t("contentModel.scene.noPlacements");
  const updated = [scene.updatedBy?.name, format.date(scene.updatedAt)].filter(Boolean).join(" · ");
  const nameClass =
    "rounded-sm text-start text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']";
  const menu = archived ? onRestore : onArchive;

  return (
    <li className={`relative flex flex-wrap items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/50 ${SCENE_ROW_GRID}`}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden>
          <Film className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate" title={scene.name}>
            {href ? (
              <Link href={href} className={nameClass}>{scene.name}</Link>
            ) : (
              <button type="button" className={nameClass} onClick={() => onOpen?.(scene.id)}>{scene.name}</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ContentStatusBadge kind={scene.status} number={scene.status === "published" ? scene.latestRevisionNo : undefined} />
            {(scene.status === "changed" || scene.status === "archived") && scene.latestRevisionNo != null && (
              <Text as="span" variant="bodyXs" tone="subdued">{t("contentModel.scene.liveRevision", { number: scene.latestRevisionNo })}</Text>
            )}
          </div>
          <Text as="p" variant="bodyXs" tone="subdued" className="lg:hidden">{[placements, updated].join(" · ")}</Text>
        </div>
      </div>

      <Cell label={t("contentModel.scene.column.placements")}>
        <Text as="span" variant="bodySm" tone={scene.placementCount ? "default" : "subdued"}>{placements}</Text>
      </Cell>
      <Cell label={t("contentModel.scene.column.updated")}>
        <Text as="span" variant="bodySm" tone="subdued" truncate className="block" title={updated}>{updated}</Text>
      </Cell>

      <div className="relative z-10 ms-auto flex items-center gap-1 lg:justify-end">
        {onCopy && (
          <Button variant="outline" size="sm" onClick={() => onCopy(scene)} disabled={busy} aria-label={t("contentModel.scene.copyNamed", { name: scene.name })}>
            <Copy aria-hidden />
            <span className="hidden sm:inline">{t("contentModel.scene.copy")}</span>
          </Button>
        )}
        {menu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("contentModel.scene.moreNamed", { name: scene.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => menu(scene)}>
                {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                {archived ? t("contentModel.scene.restore") : t("contentModel.scene.archive")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
