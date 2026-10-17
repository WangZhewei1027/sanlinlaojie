"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContentFeatureState } from "./components/ContentFeatureState";
import { LegacyManageView } from "./components/LegacyManageView";
import { RouteRedirect } from "./components/RouteRedirect";
import { TeamPageLoading, TeamShell } from "./components/TeamShell";
import { isSpecificWorkspaceId } from "./constants";
import { collectionHref, useContentModel, useTeamContext } from "./lib/content-context";
import { useIntegrationText, type IntegrationTexts } from "./lib/integration-text";
import { WorkbenchRoute } from "./workbench/WorkbenchRoute";

const TEXTS: IntegrationTexts = {
  "contentModel.state.loading": ["正在加载", "Loading"],
};

export default function ManagePage() {
  return (
    <Suspense fallback={<ManageLoading />}>
      <ManagePageContent />
    </Suspense>
  );
}

function ManageLoading() {
  const tx = useIntegrationText(TEXTS);
  return <TeamShell organizationId={null}><TeamPageLoading label={tx("contentModel.state.loading")} /></TeamShell>;
}

/**
 * /manage is the team workbench once the team runs content model v2 (or is
 * frozen as readonly). Teams still on legacy/preparing keep the old asset
 * map here unchanged. A legacy deep link `?workspaceId=` opens that map
 * collection instead, keeping `placementId` and the other parameters.
 */
function ManagePageContent() {
  const team = useTeamContext();
  const model = useContentModel(team.organizationId);
  const params = useSearchParams();

  if (!team.organizationId) {
    if (team.loading) return <ManageLoading />;
    return <TeamShell organizationId={null}><ContentFeatureState state="no-organization" mapHref="/manage" /></TeamShell>;
  }
  if (model.status === "loading") return <ManageLoading />;
  if (model.status === "error") {
    return (
      <TeamShell organizationId={team.organizationId}>
        <ContentFeatureState state="error" mapHref="/manage" error={model.error} onRetry={model.refresh} />
      </TeamShell>
    );
  }
  if (model.state === "v2" || model.state === "readonly") {
    const legacyWorkspace = params.get("workspaceId");
    if (isSpecificWorkspaceId(legacyWorkspace)) {
      const extra = Object.fromEntries([...params.entries()].filter(([key]) => key !== "workspaceId" && key !== "organizationId"));
      return <RouteRedirect to={collectionHref(legacyWorkspace, team.organizationId, extra)} />;
    }
    return <WorkbenchRoute key={team.organizationId} team={team} model={model} />;
  }
  return <LegacyManageView readOnly={false} />;
}
