"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { useContentModel, useTeamContext } from "@/app/manage/lib/content-context";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { LegacyOnsiteUpload } from "./components/LegacyOnsiteUpload";
import { V2OnsiteUpload } from "./components/V2OnsiteUpload";
import { ONSITE_TEXTS } from "./onsite-texts";

export default function UploadOnsitePage() {
  return (
    <Suspense fallback={<OnsiteSkeleton />}>
      <OnsiteUploadGate />
    </Suspense>
  );
}

/**
 * Chooses the upload path from the organization's server-declared content
 * model state: `v2` uses the one-step upload-and-place command, `readonly`
 * shows the frozen state, everything else keeps the legacy path unchanged.
 */
function OnsiteUploadGate() {
  const tx = useIntegrationText(ONSITE_TEXTS);
  const team = useTeamContext();
  const model = useContentModel(team.organizationId);

  if (!team.organizationId) return <LegacyOnsiteUpload />;
  if (model.status === "loading") return <OnsiteSkeleton label={tx("contentModel.integration.onsite.checkingState")} />;
  if (model.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <ContentNotice
          tone="critical"
          title={tx("contentModel.integration.onsite.stateError")}
          description={model.error ?? undefined}
          action={<Button variant="outline" size="sm" onClick={model.refresh}>{tx("contentModel.action.retry")}</Button>}
        />
      </div>
    );
  }
  if (model.state === "v2" || model.state === "readonly") {
    return <V2OnsiteUpload team={team} frozen={model.state === "readonly"} />;
  }
  return <LegacyOnsiteUpload />;
}

function OnsiteSkeleton({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
