"use client";

import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { TeamPageLoading, TeamShell } from "@/app/manage/components/TeamShell";
import { CollectionList, type ContentLifecycle } from "@/app/manage/content";
import { useCollections } from "@/app/manage/lib/collections";
import { collectionApi, isEndpointMissing, organizationApi } from "@/app/manage/lib/content-api";
import { collectionHref, teamCanWrite, useTeamContext } from "@/app/manage/lib/content-context";
import { ERROR_TEXTS, errorMessage, runContentAction } from "@/app/manage/lib/content-errors";
import { toCollectionItem } from "@/app/manage/lib/content-mappers";
import { useIntegrationText, type IntegrationTexts } from "@/app/manage/lib/integration-text";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
  const team = useTeamContext();
  const organizationId = team.organizationId;
  const [state, setState] = useState<ContentLifecycle>("active");
  const list = useCollections(organizationId, state);
  const items = useMemo(() => list.collections.map(toCollectionItem), [list.collections]);
  const canCreate = teamCanWrite({ archivedAt: team.organization?.archived_at, orgRole: team.organization?.role, globalRole: team.currentUserRole });
  const shell = (body: React.ReactNode) => <TeamShell organizationId={organizationId}>{body}</TeamShell>;

  if (!organizationId) return shell(team.loading ? <TeamPageLoading label={t("contentModel.state.loading")} /> : <ContentFeatureState state="no-organization"  />);

  const listError = list.error ? (isEndpointMissing(list.error) ? tx("contentModel.integration.collections.endpointMissing") : errorMessage(list.error, tx)) : undefined;
  const readOnlyReason = team.organization?.role === "viewer" ? t("contentModel.workbench.readOnlyViewer") : t("contentModel.workbench.readOnlyOther");

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
      onCreate={(input) => runContentAction(() => organizationApi.createCollection(organizationId, { name: input.name, description: input.description || null }), tx, (collection) => {
        list.reload();
        toast.success(tx("contentModel.integration.collections.created", { name: collection.name }), {
          action: { label: tx("contentModel.integration.collections.open"), onClick: () => window.open(collectionHref(collection.id, organizationId), "_blank", "noopener,noreferrer") },
        });
      })}
      onEdit={(id, input) => runContentAction(() => collectionApi.update(id, { name: input.name, description: input.description || null }), tx, list.reload)}
      onArchive={(id) => runContentAction(() => collectionApi.archive(id), tx, list.reload)}
      onRestore={(id) => runContentAction(() => collectionApi.restore(id), tx, list.reload)}
    />,
  );
}
