"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { ContentThumbnail } from "./ContentThumbnail";
import { useContentFormat } from "./useContentFormat";
import type { AssetDetailData } from "./types";

export interface AssetDetailHeaderProps {
  asset: AssetDetailData;
  canMaintain: boolean;
  onUploadVersion: () => void;
  /** Optional larger preview (image, model, audio) supplied by the page. */
  preview?: ReactNode;
}

/** Identity block with the surface's single primary action: upload a new version. */
export function AssetDetailHeader({ asset, canMaintain, onUploadVersion, preview }: AssetDetailHeaderProps) {
  const { t } = useTranslation();
  const format = useContentFormat();
  const archived = asset.state === "archived";
  const facts: Array<[string, string]> = [
    [t("contentModel.detail.type"), t(`fileTypes.${asset.type}`)],
    [t("contentModel.detail.currentVersion"), `v${asset.currentVersionNo}`],
    [t("contentModel.detail.maintainer"), asset.maintainer?.name ?? t("contentModel.library.noMaintainerShort")],
    [t("contentModel.detail.originProject"), asset.originProjectName ?? t("contentModel.detail.originUnknown")],
    [t("contentModel.detail.source"), t(`contentModel.filter.origins.${asset.origin}`)],
    [t("contentModel.detail.created"), format.date(asset.createdAt)],
  ];

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="shrink-0">{preview ?? <ContentThumbnail type={asset.type} name={asset.name} thumbnailUrl={asset.thumbnailUrl} textExcerpt={asset.textExcerpt} />}</div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <Text as="h1" variant="headingLg" breakWord>{asset.name}</Text>
            <div className="flex flex-wrap items-center gap-1.5">
              <ContentStatusBadge kind={asset.visibility} />
              {archived && <ContentStatusBadge kind="archived" />}
              {asset.fileMissing && <ContentStatusBadge kind="fileMissing" />}
            </div>
          </div>
          {canMaintain && !archived && (
            <Button onClick={onUploadVersion} className="self-start">
              <Upload aria-hidden />
              {t("contentModel.version.upload")}
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate text-sm" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        {!canMaintain && (
          <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.detail.useOnlyHint")}</Text>
        )}
      </div>
    </header>
  );
}
