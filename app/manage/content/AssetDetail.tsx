"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AssetDetailHeader } from "./AssetDetailHeader";
import { AssetMaintenancePanel } from "./AssetMaintenancePanel";
import { AssetSharingPanel } from "./AssetSharingPanel";
import { AssetUsagePanel } from "./AssetUsagePanel";
import { AssetVersionHistory } from "./AssetVersionHistory";
import { AssetVersionUploadDialog, type AssetVersionInput } from "./AssetVersionUploadDialog";
import { ContentNotice } from "./ContentFeedback";
import type {
  AssetDetailData,
  AssetProjectGrant,
  AssetUsageKind,
  AssetUsageSummary,
  AssetVersion,
  AssetVisibility,
  ContentAction,
  ContentLoadStatus,
  ContentPerson,
  ContentProject,
} from "./types";

export interface AssetDetailProps {
  asset: AssetDetailData;
  preview?: ReactNode;
  canMaintain: boolean;
  canTransfer: boolean;
  /** Set after a write returned a stale lock; the page reloads fresh data. */
  stale?: boolean;
  onReload?: () => void;

  versions: AssetVersion[];
  currentVersionId: string;
  versionsStatus?: ContentLoadStatus;
  onRetryVersions?: () => void;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
  uploadAccept?: string;
  uploadProgress?: number | null;
  onUploadVersion: ContentAction<[input: AssetVersionInput]>;

  usage: AssetUsageSummary;
  usageByKind: Record<AssetUsageKind, number>;
  usageStatus?: ContentLoadStatus;
  onRetryUsage?: () => void;
  usageHasMore?: boolean;
  usageLoadingMore?: boolean;
  onLoadMoreUsage?: () => void;

  grants: AssetProjectGrant[];
  grantableProjects: ContentProject[];
  onVisibilityChange: ContentAction<[visibility: AssetVisibility]>;
  onGrant: ContentAction<[projectId: string]>;
  onRevoke: ContentAction<[projectId: string]>;

  maintainerCandidates: ContentPerson[];
  onTransfer: ContentAction<[personId: string]>;
  onArchive: ContentAction;
  onRestore: ContentAction;
}

/** Asset detail: identity, versions and usage in the main column; sharing and maintenance beside. */
export function AssetDetail(props: AssetDetailProps) {
  const { t } = useTranslation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const { asset } = props;
  const archived = asset.state === "archived";
  const nextVersionNo = Math.max(asset.currentVersionNo, ...props.versions.map((version) => version.versionNo)) + 1;
  const selectedVersion = props.versions.find((version) => version.id === props.selectedVersionId);

  return (
    <div className="flex flex-col gap-6">
      <AssetDetailHeader asset={asset} canMaintain={props.canMaintain} onUploadVersion={() => setUploadOpen(true)} preview={props.preview} />

      {props.stale && (
        <ContentNotice
          tone="warning"
          title={t("contentModel.detail.staleTitle")}
          description={t("contentModel.detail.staleBody")}
          action={props.onReload && <Button variant="outline" size="sm" onClick={props.onReload}>{t("contentModel.action.reload")}</Button>}
        />
      )}
      {archived && <ContentNotice title={t("contentModel.detail.archivedTitle")} description={t("contentModel.detail.archivedBody")} />}
      {asset.fileMissing && <ContentNotice tone="critical" title={t("contentModel.detail.fileMissingTitle")} description={t("contentModel.detail.fileMissingBody")} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <AssetVersionHistory
            versions={props.versions}
            currentVersionId={props.currentVersionId}
            status={props.versionsStatus}
            onRetry={props.onRetryVersions}
            selectedVersionId={props.selectedVersionId}
            onSelectVersion={props.onSelectVersion}
          />
          <AssetUsagePanel
            usage={props.usage}
            currentVersionNo={asset.currentVersionNo}
            status={props.usageStatus}
            onRetry={props.onRetryUsage}
            versionFilterNo={selectedVersion?.versionNo ?? null}
            hasMore={props.usageHasMore}
            loadingMore={props.usageLoadingMore}
            onLoadMore={props.onLoadMoreUsage}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <AssetSharingPanel
            visibility={asset.visibility}
            grants={props.grants}
            grantableProjects={props.grantableProjects}
            canMaintain={props.canMaintain}
            archived={archived}
            onVisibilityChange={props.onVisibilityChange}
            onGrant={props.onGrant}
            onRevoke={props.onRevoke}
          />
          <AssetMaintenancePanel
            assetName={asset.name}
            state={asset.state}
            maintainer={asset.maintainer}
            canMaintain={props.canMaintain}
            canTransfer={props.canTransfer}
            candidates={props.maintainerCandidates}
            impact={props.usageByKind}
            onTransfer={props.onTransfer}
            onArchive={props.onArchive}
            onRestore={props.onRestore}
          />
        </div>
      </div>

      <AssetVersionUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        assetName={asset.name}
        assetType={asset.type}
        nextVersionNo={nextVersionNo}
        accept={props.uploadAccept}
        progress={props.uploadProgress}
        onSubmit={props.onUploadVersion}
      />
    </div>
  );
}
