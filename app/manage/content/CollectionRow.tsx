"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, MapPinned, MoreHorizontal, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { useContentFormat } from "./useContentFormat";
import type { CollectionItem } from "./types";

export interface CollectionRowProps {
  collection: CollectionItem;
  href: string;
  onEdit?: (collection: CollectionItem) => void;
  onArchive?: (collection: CollectionItem) => void;
  onRestore?: (collection: CollectionItem) => void;
  busy?: boolean;
}

/** One map collection: the whole row opens its map; edits live in the overflow menu. */
export function CollectionRow({ collection, href, onEdit, onArchive, onRestore, busy }: CollectionRowProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const lifecycle = collection.archived ? onRestore : onArchive;
  const meta = [t("contentModel.collections.kind.map"), collection.createdAt ? t("contentModel.collections.created", { date: format.date(collection.createdAt) }) : null].filter(Boolean).join(" · ");

  return (
    <li className="relative flex items-center gap-3 px-3 py-3 transition-colors focus-within:bg-muted/50 hover:bg-muted/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden>
        <MapPinned className={collection.archived ? "size-5 text-muted-foreground/60" : "size-5 text-muted-foreground"} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            title={collection.name}
            className="truncate rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']"
          >
            {collection.name}
          </Link>
          {collection.archived && <ContentStatusBadge kind="archived" />}
        </div>
        {collection.description && <p className="truncate text-sm text-muted-foreground" title={collection.description}>{collection.description}</p>}
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
      {(onEdit || lifecycle) && (
        <div className="relative z-10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("contentModel.collections.moreNamed", { name: collection.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onSelect={() => onEdit(collection)}><PencilLine aria-hidden />{t("contentModel.collections.edit")}</DropdownMenuItem>
              )}
              {lifecycle && (
                <DropdownMenuItem onSelect={() => lifecycle(collection)}>
                  {collection.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                  {collection.archived ? t("contentModel.collections.restore") : t("contentModel.collections.archive")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
