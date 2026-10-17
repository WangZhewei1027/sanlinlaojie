"use client";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { ContentFeatureState } from "./components/ContentFeatureState";
import { TeamPageLoading, TeamShell } from "./components/TeamShell";
import { useTeamContext } from "./lib/content-context";
import { WorkbenchRoute } from "./workbench/WorkbenchRoute";

export default function ManagePage() {
  return <Suspense><ManagePageContent /></Suspense>;
}
function ManagePageContent() {
  const team = useTeamContext();
  const { t } = useTranslation();
  if (!team.organizationId) return <TeamShell organizationId={null}>{team.loading
    ? <TeamPageLoading label={t("contentModel.state.loading")} />
    : <ContentFeatureState state="no-organization" />}</TeamShell>;
  return <WorkbenchRoute key={team.organizationId} team={team} />;
}
