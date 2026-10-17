"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { ContentThumbnail } from "./ContentThumbnail";
import { useContentFormat } from "./useContentFormat";
import type { AssetLibraryItem, AssetLibraryScope } from "./types";

/** Desktop column template shared by the list header and every row. */
export const ASSET_ROW_GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_9rem_4rem_6.5rem_8rem_8.5rem] lg:items-center lg:gap-4";

export interface AssetLibraryRowProps {
  asset: AssetLibraryItem;
  scope: AssetLibraryScope;
  href?: string;
  onOpen?: (assetId: string) => void;
  /** Organization scope only: grant the current project use of this asset. */
  onAddToProject?: (assetId: string) => void;
  adding?: boolean;
}

export function AssetLibraryRow({ asset, scope, href, onOpen, onAddToProject, adding }: AssetLibraryRowProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const archived = asset.state === "archived";
  const usage = asset.usageCount ? t("contentModel.usage.count", { count: asset.usageCount }) : t("contentModel.usage.none");
  const canAdd = scope === "organization" && !asset.inProject && !archived && !!onAddToProject;
  const nameClass =
    "rounded-sm text-start text-sm font-medium text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']";

  return (
    <li className={`relative flex gap-3 px-3 py-3 transition-colors hover:bg-muted/50 ${ASSET_ROW_GRID}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div className={archived ? "opacity-60" : undefined}>
          <ContentThumbnail type={asset.type} name={asset.name} thumbnailUrl={asset.thumbnailUrl} textExcerpt={asset.textExcerpt} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="min-w-0 truncate" title={asset.name}>
            {href ? (
              <Link href={href} className={nameClass}>{asset.name}</Link>
            ) : (
              <button type="button" className={nameClass} onClick={() => onOpen?.(asset.id)}>{asset.name}</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Text as="span" variant="bodyXs" tone="subdued">{t(`fileTypes.${asset.type}`)}</Text>
            <ContentStatusBadge kind={asset.visibility} />
            {asset.inProject && scope === "organization" && <ContentStatusBadge kind="inProject" />}
            {archived && <ContentStatusBadge kind="archived" />}
            {asset.fileMissing && <ContentStatusBadge kind="fileMissing" />}
          </div>
          {scope === "organization" && asset.originProjectName && (
            <Text as="span" variant="bodyXs" tone="subdued" truncate title={asset.originProjectName} className="relative block">
              {t("contentModel.library.fromProject", { name: asset.originProjectName })}
            </Text>
          )}
          {/* Narrow screens: the desktop columns collapse into one metadata line. */}
          <Text as="p" variant="bodyXs" tone="subdued" className="lg:hidden">
            {[
              asset.maintainer ? t("contentModel.library.maintainedBy", { name: asset.maintainer.name }) : t("contentModel.library.noMaintainer"),
              `v${asset.currentVersionNo}`,
              usage,
            ].join(" · ")}
          </Text>
        </div>
      </div>

      <Cell label={t("contentModel.library.column.maintainer")}>
        {asset.maintainer ? (
          <Text as="span" variant="bodySm" truncate title={asset.maintainer.name} className="block">{asset.maintainer.name}</Text>
        ) : (
          <Text as="span" variant="bodySm" tone="warning">{t("contentModel.library.noMaintainerShort")}</Text>
        )}
      </Cell>
      <Cell label={t("contentModel.library.column.version")}>
        <Text as="span" variant="bodySm" className="tabular-nums">v{asset.currentVersionNo}</Text>
      </Cell>
      <Cell label={t("contentModel.library.column.usage")}>
        <Text as="span" variant="bodySm" tone={asset.usageCount ? "default" : "subdued"} className="tabular-nums">{usage}</Text>
      </Cell>
      <Cell label={t("contentModel.library.column.updated")}>
        <Text as="span" variant="bodySm" tone="subdued" className="tabular-nums">{format.date(asset.updatedAt)}</Text>
      </Cell>

      <div className="relative z-10 flex shrink-0 items-center self-center lg:justify-end">
        {canAdd && (
          <Button
            variant="outline"
            size="sm"
            disabled={adding}
            onClick={() => onAddToProject?.(asset.id)}
            aria-label={t("contentModel.library.addNamedToProject", { name: asset.name })}
          >
            {adding ? <Loader2 className="animate-spin" aria-hidden /> : <FolderPlus aria-hidden />}
            <span className="hidden sm:inline">{t("contentModel.library.addToProject")}</span>
          </Button>
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
