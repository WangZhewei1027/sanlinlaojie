"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { WorkspaceQrButton } from "@/components/workspace-qr-button";
import { CollectionList, type ContentLifecycle } from "@/app/manage/content";
import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { TeamPageLoading, TeamShell } from "@/app/manage/components/TeamShell";
import { useCollections } from "@/app/manage/lib/collections";
import { collectionApi, isEndpointMissing, organizationApi } from "@/app/manage/lib/content-api";
import { collectionHref, teamCanWrite, teamHref, useContentModel, useTeamContext } from "@/app/manage/lib/content-context";
import { ERROR_TEXTS, errorMessage, runContentAction } from "@/app/manage/lib/content-errors";
import { toCollectionItem } from "@/app/manage/lib/content-mappers";
import { useIntegrationText, type IntegrationTexts } from "@/app/manage/lib/integration-text";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.collections.endpointMissing": ["合集服务尚未就绪，请稍后再试。", "The collection service is not available yet. Try again later."],
  "contentModel.integration.collections.created": ["已创建合集“{{name}}”", "Created “{{name}}”"],
  "contentModel.integration.collections.open": ["打开地图", "Open map"],
};

/** /manage/collections: the team's map collections. */
export function CollectionsRoute() {
  const { t } = useTranslation();
  const tx = useIntegrationText(TEXTS);
  const router = useRouter();
  const team = useTeamContext();
  const organizationId = team.organizationId;
  const model = useContentModel(organizationId);
  const [state, setState] = useState<ContentLifecycle>("active");
  const browsable = model.state === "v2" || model.state === "readonly";
  const list = useCollections(organizationId, state, browsable);
  const items = useMemo(() => list.collections.map(toCollectionItem), [list.collections]);
  const canCreate = teamCanWrite({ state: model.state, dto: model.dto, orgRole: team.organization?.role, globalRole: team.currentUserRole });
  // The team-level mini-program QR (no collection) keeps the old "all workspaces" entry.
  const teamQr = organizationId && browsable ? <WorkspaceQrButton organizationId={organizationId} workspaceId={null} /> : undefined;
  const shell = (body: React.ReactNode) => <TeamShell organizationId={organizationId} aside={teamQr}>{body}</TeamShell>;

  if (!organizationId) return shell(team.loading ? <TeamPageLoading label={t("contentModel.state.loading")} /> : <ContentFeatureState state="no-organization" mapHref="/manage" />);
  if (model.status === "loading") return shell(<TeamPageLoading label={t("contentModel.state.loading")} />);
  if (model.status === "error") return shell(<ContentFeatureState state="error" mapHref="/manage" error={model.error} onRetry={model.refresh} />);
  // Legacy teams keep their workspaces on the old map and the old admin page.
  if (!browsable) return shell(<ContentFeatureState state={model.state ?? "legacy"} mapHref={teamHref("/manage", organizationId)} />);

  const listError = list.error ? (isEndpointMissing(list.error) ? tx("contentModel.integration.collections.endpointMissing") : errorMessage(list.error, tx)) : undefined;
  const readOnlyReason = model.state === "readonly"
    ? t("contentModel.workbench.readOnlyFrozen")
    : team.organization?.role === "viewer" ? t("contentModel.workbench.readOnlyViewer") : t("contentModel.workbench.readOnlyOther");

  return shell(
    <CollectionList
      team={{ name: team.organization?.name ?? "" }}
      state={state}
      onStateChange={setState}
      status={list.status === "idle" ? "loading" : list.status}
      errorMessage={listError}
      onRetry={list.reload}
      collections={items}
      getHref={(id) => collectionHref(id, organizationId)}
      canCreate={canCreate}
      readOnlyReason={readOnlyReason}
      notice={model.state === "readonly" ? <ContentFeatureState state="readonly" mapHref={teamHref("/manage", organizationId)} /> : undefined}
      onCreate={(input) => runContentAction(() => organizationApi.createCollection(organizationId, { name: input.name, description: input.description || null }), tx, (collection) => {
        list.reload();
        toast.success(tx("contentModel.integration.collections.created", { name: collection.name }), {
          action: { label: tx("contentModel.integration.collections.open"), onClick: () => router.push(collectionHref(collection.id, organizationId)) },
        });
      })}
      onEdit={(id, input) => runContentAction(() => collectionApi.update(id, { name: input.name, description: input.description || null }), tx, list.reload)}
      onArchive={(id) => runContentAction(() => collectionApi.archive(id), tx, list.reload)}
      onRestore={(id) => runContentAction(() => collectionApi.restore(id), tx, list.reload)}
    />,
  );
}
