"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ContentNotice } from "@/app/manage/content";
import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { errorMessage } from "@/app/manage/lib/content-errors";
import type { IntegrationT } from "@/app/manage/lib/integration-text";

/** Page-level banners above the detail: frozen organization, failed refresh, archive outcome. */
export function AssetDetailNotices({ readonly, mapHref, refreshError, onRetry, archiveImpact, onDismissArchive, tx }: {
  readonly: boolean;
  mapHref: string;
  refreshError: unknown;
  onRetry: () => void;
  /** Localized dependency lines returned by the archive command; null when not just archived. */
  archiveImpact: string[] | null;
  onDismissArchive: () => void;
  tx: IntegrationT;
}) {
  const { t } = useTranslation();
  return (
    <>
      {readonly && <ContentFeatureState state="readonly" mapHref={mapHref} />}
      {!!refreshError && (
        <ContentNotice
          tone="warning"
          title={tx("contentModel.integration.assetDetail.refreshFailed")}
          description={errorMessage(refreshError, tx)}
          action={<Button variant="outline" size="sm" onClick={onRetry}>{t("contentModel.action.retry")}</Button>}
        />
      )}
      {archiveImpact && (
        <ContentNotice
          title={tx("contentModel.integration.assetDetail.archivedTitle")}
          description={archiveImpact.length ? (
            <>
              <p>{tx("contentModel.integration.assetDetail.archivedImpact")}</p>
              <ul className="mt-1 list-disc space-y-0.5 ps-4">{archiveImpact.map((line) => <li key={line}>{line}</li>)}</ul>
            </>
          ) : tx("contentModel.integration.assetDetail.archivedNoImpact")}
          action={<Button variant="ghost" size="sm" onClick={onDismissArchive}>{tx("contentModel.integration.assetDetail.dismiss")}</Button>}
        />
      )}
    </>
  );
}
