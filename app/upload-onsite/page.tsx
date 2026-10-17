"use client";
import { ContentFeatureState } from "@/app/manage/components/ContentFeatureState";
import { useTeamContext } from "@/app/manage/lib/content-context";
import { Suspense } from "react";
import { OnsiteUpload } from "./components/OnsiteUpload";
export default function OnsitePage() { return <Suspense><OnsiteRoute /></Suspense>; }
function OnsiteRoute() {
  const team = useTeamContext();
  if (!team.organizationId) return <div className="mx-auto max-w-2xl p-4"><ContentFeatureState state="no-organization" /></div>;
  return <OnsiteUpload team={team} teamArchived={!!team.organization?.archived_at} />;
}
