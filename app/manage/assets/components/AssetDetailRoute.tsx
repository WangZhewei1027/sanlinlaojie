"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Copy, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetVersionDto } from "@/lib/content-model/contracts";
import { AssetDetail, ContentErrorState } from "@/app/manage/content";
import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { isContentApiError, isEndpointMissing, isFeatureStateError } from "@/app/manage/lib/content-api";
import { contextHref, useContentContext, useContentModel, useWorkspaceInfo } from "@/app/manage/lib/content-context";
import { errorMessage } from "@/app/manage/lib/content-errors";
import { toDetailData, toGrants, toUsageSummary, toVersions, usageByKind } from "@/app/manage/lib/content-mappers";
import { useOrganizationPeople } from "@/app/manage/lib/content-people";
import { acceptFor } from "@/app/manage/lib/content-upload";
import { useIntegrationText, type IntegrationT } from "@/app/manage/lib/integration-text";
import { isFileType, type CreatableType } from "./AssetContentField";
import { AssetDetailNotices } from "./AssetDetailNotices";
import { AssetDuplicateDialog } from "./AssetDuplicateDialog";
import { AssetNameDialog } from "./AssetNameDialog";
import { AssetPageLoading, AssetPageShell } from "./AssetPageShell";
import { AssetPreview, hasPreview } from "./AssetPreview";
import { ASSET_TEXTS } from "./texts";
import { useAssetDetail } from "./useAssetDetail";
import { useAssetWrites } from "./useAssetWrites";

const noteOf = (version: AssetVersionDto) => {
  const note = version.payload.attributes?.note;
  return typeof note === "string" ? note : null;
};

function loadErrorText(error: unknown, tx: IntegrationT) {
  if (isEndpointMissing(error)) return tx("contentModel.integration.assets.endpointMissing");
  if (isContentApiError(error) && error.status === 404) return tx("contentModel.integration.assetDetail.notFound");
  if (isContentApiError(error) && error.status === 403) return tx("contentModel.integration.assetDetail.forbidden");
  return errorMessage(error, tx);
}

/** /manage/assets/[id]: identity, versions, usage, sharing and maintenance of one asset. */
export function AssetDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Keyed by id so selection, stale and archive notices never leak into another asset.
  return <AssetDetailView key={id} id={id} />;
}

function AssetDetailView({ id }: { id: string }) {
  const { t } = useTranslation();
  const tx = useIntegrationText(ASSET_TEXTS);
  const router = useRouter();
  const ctx = useContentContext();
  const detail = useAssetDetail(id);
  const asset = detail.asset;
  const organizationId = asset?.organization_id ?? ctx.organizationId;
  const model = useContentModel(organizationId);
  const people = useOrganizationPeople(asset?.organization_id ?? null);
  const contextInfo = useWorkspaceInfo(ctx.workspaceId);
  const writes = useAssetWrites(detail, ctx.workspaceId, tx);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  // Store projects belong to the store's organization; only trust them for the asset's organization.
  const projects = useMemo(
    () => ctx.workspaces
      .filter((item) => (item.organization_id ? item.organization_id === organizationId : ctx.synced && ctx.organizationId === organizationId))
      .map((item) => ({ id: item.id, name: item.name })),
    [ctx.workspaces, ctx.synced, ctx.organizationId, organizationId],
  );
  const libraryHref = contextHref("/manage/assets", { organizationId, workspaceId: ctx.workspaceId });
  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link href={libraryHref}><ArrowLeft aria-hidden />{tx("contentModel.integration.assetDetail.back")}</Link>
    </Button>
  );
  const shell = (body: ReactNode, aside?: ReactNode) => (
    <AssetPageShell organizationId={organizationId} workspaceId={ctx.workspaceId} aside={aside}>{body}</AssetPageShell>
  );
  const mapHref = contextHref("/manage", { organizationId, workspaceId: ctx.workspaceId });

  if (!asset) {
    if (detail.assetStatus === "loading") return shell(<AssetPageLoading label={t("contentModel.state.loading")} />);
    const error = detail.assetError;
    const featureState = isFeatureStateError(error) && isContentApiError(error) ? error.details?.content_model_state ?? "legacy" : null;
    // UPGRADE_REQUIRED from a v2 organization means this page is stale: show it as an error with retry.
    if (featureState && featureState !== "v2") return shell(<ContentFeatureState state={featureState} mapHref={mapHref} />);
    return shell(
      <div className="overflow-hidden rounded-lg border bg-background">
        <ContentErrorState message={loadErrorText(error, tx)} onRetry={detail.retryAsset} />
      </div>,
      backLink,
    );
  }
  if (model.status === "ready" && model.state !== "v2" && model.state !== "readonly") {
    return shell(<ContentFeatureState state={model.state ?? "legacy"} mapHref={mapHref} />);
  }

  const writable = model.state === "v2";
  const archived = asset.state === "archived";
  const canMaintain = writable && asset.capabilities.can_maintain;
  const canTransfer = writable && asset.capabilities.can_transfer_maintainer;
  const projectNames = new Map<string, string>([...projects.map((item) => [item.id, item.name] as const), ...asset.grants.map((grant) => [grant.workspace_id, grant.workspace_name ?? ""] as const)].filter(([, name]) => !!name));
  const data = toDetailData(asset, projectNames);
  const sortedVersions = [...asset.versions].sort((a, b) => b.version_no - a.version_no);
  const notes = new Map(sortedVersions.map((version) => [version.id, noteOf(version)]));
  const versions = toVersions(sortedVersions, people.byId, detail.usage?.impact).map((version) => ({ ...version, note: notes.get(version.id) ?? null }));
  const granted = new Set(asset.grants.map((grant) => grant.workspace_id));
  const archivedProjects = new Set(ctx.workspaceId && contextInfo.workspace?.archived_at ? [ctx.workspaceId] : []);
  const previewVersion = asset.versions.find((version) => version.id === (selectedVersionId ?? asset.current_version_id)) ?? asset.current_version;
  const type = asset.file_type as CreatableType;

  return shell(
    <>
      <AssetDetailNotices
        readonly={model.state === "readonly"}
        mapHref={mapHref}
        refreshError={detail.assetError}
        onRetry={detail.retryAsset}
        archiveImpact={writes.archiveImpact}
        onDismissArchive={writes.dismissArchiveImpact}
        tx={tx}
      />
      <AssetDetail
        asset={data}
        preview={hasPreview(previewVersion) ? <AssetPreview version={previewVersion} name={data.name} tx={tx} /> : undefined}
        canMaintain={canMaintain}
        canTransfer={canTransfer}
        stale={writes.stale}
        onReload={writes.reload}
        versions={versions}
        currentVersionId={asset.current_version_id ?? ""}
        versionsStatus="ready"
        selectedVersionId={selectedVersionId}
        onSelectVersion={setSelectedVersionId}
        uploadAccept={isFileType(type) ? acceptFor(type) || undefined : undefined}
        uploadProgress={null}
        onUploadVersion={writes.uploadVersion}
        usage={toUsageSummary(detail.usage?.impact, asset.organization_id, selectedVersionId)}
        usageByKind={usageByKind(detail.usage?.impact)}
        usageStatus={detail.usageStatus}
        onRetryUsage={detail.retryUsage}
        grants={toGrants(asset.grants, asset.origin_workspace_id, archivedProjects)}
        grantableProjects={projects.filter((item) => !granted.has(item.id))}
        onVisibilityChange={writes.changeVisibility}
        onGrant={writes.grant}
        onRevoke={writes.revoke}
        maintainerCandidates={people.writable}
        onTransfer={writes.transfer}
        onArchive={writes.archive}
        onRestore={writes.restore}
      />
      <AssetNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={tx("contentModel.integration.assetDetail.renameTitle")}
        description={tx("contentModel.integration.assetDetail.renameBody")}
        nameLabel={tx("contentModel.integration.assetDetail.name")}
        submitLabel={tx("contentModel.integration.assetDetail.save")}
        cancelLabel={tx("contentModel.integration.assetDetail.cancel")}
        initialName={asset.name ?? ""}
        onSubmit={writes.rename}
      />
      <AssetDuplicateDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        assetId={asset.id}
        assetName={data.name}
        projects={projects}
        defaultProjectId={ctx.workspaceId ?? asset.origin_workspace_id}
        onDuplicated={(result, workspaceId) => router.push(contextHref(`/manage/assets/${result.asset.id}`, { organizationId: asset.organization_id, workspaceId }))}
        tx={tx}
      />
    </>,
    writable && !archived ? (
      <>
      {canMaintain && (
        <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}><PencilLine aria-hidden />{tx("contentModel.integration.assetDetail.rename")}</Button>
      )}
      {projects.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}><Copy aria-hidden />{tx("contentModel.integration.assetDetail.duplicate")}</Button>
      )}
      </>
    ) : undefined,
  );
}
