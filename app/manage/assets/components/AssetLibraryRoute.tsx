"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Text } from "@/components/ui/typography";
import { DEFAULT_UPLOAD_TYPES } from "@/lib/upload/types";
import type { AssetDto } from "@/lib/content-model/contracts";
import { AssetLibrary, ContentNotice, DEFAULT_ASSET_FILTERS, type AssetLibraryFilters, type AssetLibraryScope, type ContentProject } from "@/app/manage/content";
import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { assetApi, isEndpointMissing } from "@/app/manage/lib/content-api";
import { contextHref, useContentContext, useContentModel, useWorkspaceInfo } from "@/app/manage/lib/content-context";
import { errorMessage, runContentAction } from "@/app/manage/lib/content-errors";
import { isLibraryAsset, toLibraryItem } from "@/app/manage/lib/content-mappers";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { AssetCreateDialog } from "./AssetCreateDialog";
import { CREATABLE_TYPES } from "./AssetContentField";
import { AssetPageLoading, AssetPageShell } from "./AssetPageShell";
import { ASSET_TEXTS } from "./texts";
import { useAssetList } from "./useAssetList";

/** /manage/assets: project assets (grants) or the organization's shared catalog. */
export function AssetLibraryRoute() {
  const { t } = useTranslation();
  const tx = useIntegrationText(ASSET_TEXTS);
  const router = useRouter();
  const ctx = useContentContext();
  const { organizationId, workspaceId } = ctx;
  const model = useContentModel(organizationId);
  const info = useWorkspaceInfo(workspaceId);
  const [scope, setScope] = useState<AssetLibraryScope>("project");
  const [filters, setFilters] = useState<AssetLibraryFilters>(DEFAULT_ASSET_FILTERS);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [granted, setGranted] = useState<ReadonlySet<string>>(new Set());

  const browsable = model.state === "v2" || model.state === "readonly";
  const writable = model.state === "v2";
  const list = useAssetList({ scope, organizationId, workspaceId, filters, enabled: browsable });

  const projectNames = useMemo(() => new Map(ctx.workspaces.map((item) => [item.id, item.name])), [ctx.workspaces]);
  const project: ContentProject | null = workspaceId
    ? { id: workspaceId, name: info.workspace?.name ?? ctx.workspace?.name ?? workspaceId.slice(0, 8), archived: !!info.workspace?.archived_at }
    : null;
  const canEdit = writable && !!info.workspace?.capabilities.can_edit;
  const items = useMemo(
    () => list.rows.filter(isLibraryAsset).map((row) => ({ ...toLibraryItem(row, projectNames), inProject: granted.has(row.id) })),
    [list.rows, projectNames, granted],
  );
  const types = useMemo(() => {
    const allowed = (ctx.organization?.allowed_file_types ?? (ctx.organization ? DEFAULT_UPLOAD_TYPES : null)) as readonly string[] | null;
    return CREATABLE_TYPES.filter((type) => !allowed || allowed.includes(type));
  }, [ctx.organization]);

  const assetHref = useCallback((assetId: string) => contextHref(`/manage/assets/${assetId}`, { organizationId, workspaceId }), [organizationId, workspaceId]);

  const addToProject = useCallback(
    (assetId: string) => {
      if (!workspaceId) return Promise.resolve();
      return runContentAction(() => assetApi.grant(assetId, workspaceId), tx, () => {
        setGranted((prev) => new Set(prev).add(assetId));
        toast.success(tx("contentModel.integration.assets.addedToProject"));
      });
    },
    [workspaceId, tx],
  );

  const created = (asset: AssetDto) => {
    list.reload();
    toast.success(tx("contentModel.integration.assets.created", { name: asset.name ?? "" }), {
      action: { label: tx("contentModel.integration.assets.open"), onClick: () => router.push(assetHref(asset.id)) },
    });
  };

  const shell = (body: ReactNode) => (
    <AssetPageShell organizationId={organizationId} workspaceId={workspaceId}>
      <Text as="h1" variant="headingLg">{tx("contentModel.integration.assets.title")}</Text>
      {body}
    </AssetPageShell>
  );

  const mapHref = contextHref("/manage", { organizationId, workspaceId });
  if (!organizationId) {
    return shell(ctx.loading ? <AssetPageLoading label={t("contentModel.state.loading")} /> : <ContentFeatureState state="no-organization" mapHref={mapHref} />);
  }
  if (model.status === "loading") return shell(<AssetPageLoading label={t("contentModel.state.loading")} />);
  if (model.status === "error") return shell(<ContentFeatureState state="error" mapHref={mapHref} error={model.error} onRetry={model.refresh} />);
  if (!browsable) return shell(<ContentFeatureState state={model.state ?? "legacy"} mapHref={mapHref} />);

  const listError = list.error ? (isEndpointMissing(list.error) ? tx("contentModel.integration.assets.endpointMissing") : errorMessage(list.error, tx)) : undefined;

  return shell(
    <>
      {model.state === "readonly" && <ContentFeatureState state="readonly" mapHref={mapHref} />}
      <AssetLibrary
        organizationName={ctx.organization?.name ?? tx("contentModel.integration.assets.unknownOrganization")}
        project={project}
        role={info.workspace?.project_role ?? null}
        scope={scope}
        onScopeChange={setScope}
        filters={filters}
        onFiltersChange={setFilters}
        status={list.status}
        errorMessage={listError}
        onRetry={list.reload}
        items={items}
        totalCount={list.total ?? undefined}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onLoadMore={list.loadMore}
        canUpload={canEdit && types.length > 0}
        onUpload={() => setUploadOpen(true)}
        canAddToProject={canEdit}
        onAddToProject={addToProject}
        getAssetHref={assetHref}
      />
      {!!list.moreError && (
        <ContentNotice tone="critical" title={tx("contentModel.integration.assets.loadMoreFailed")} description={errorMessage(list.moreError, tx)} />
      )}
      {project && canEdit && !project.archived && (
        <AssetCreateDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          workspaceId={project.id}
          projectName={project.name}
          types={types}
          onCreated={created}
        />
      )}
    </>,
  );
}
