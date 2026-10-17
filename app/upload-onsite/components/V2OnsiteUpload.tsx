"use client";

import { useMemo, useState } from "react";
import { Text } from "@/components/ui/typography";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { type ContentContext, useWorkspaceInfo } from "@/app/manage/lib/content-context";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { useGPS } from "../hooks/useGPS";
import { type OnsiteCapture, useOnsitePlacement } from "../hooks/useOnsitePlacement";
import { ONSITE_TEXTS } from "../onsite-texts";
import { AudioRecorder } from "./AudioRecorder";
import { CameraUpload } from "./CameraUpload";
import { GPSStatusCard } from "./GPSStatusCard";
import { type ConfirmedLocation, LocationConfirm } from "./LocationConfirm";
import { ModeSelector } from "./ModeSelector";
import { TagSelector } from "./TagSelector";
import { TextUpload } from "./TextUpload";
import { UploadReceiptCard } from "./UploadReceiptCard";
import { OnsiteAccessNotice } from "./OnsiteAccessNotice";
import { WorkspaceContextCard } from "./WorkspaceContextCard";

type UploadMode = "camera" | "text" | "audio";

/**
 * Onsite capture for organizations on content model v2: explicit project,
 * server-side edit capability, confirmed device location, then one
 * "upload and place" command that returns a fixed-version receipt.
 */
export function V2OnsiteUpload({ context, frozen }: { context: ContentContext; frozen: boolean }) {
  const tx = useIntegrationText(ONSITE_TEXTS);
  const { gpsPosition, gpsError, gpsLoading } = useGPS();
  const { organizationId, workspaceId } = context;
  const info = useWorkspaceInfo(workspaceId);
  const workspace = info.workspace;
  const projectName = workspace?.name ?? context.workspace?.name ?? null;
  const archived = Boolean(workspace?.archived_at);
  const canEdit = !frozen && !archived && workspace?.capabilities.can_edit === true;

  const [mode, setMode] = useState<UploadMode>("camera");
  const [confirmed, setConfirmed] = useState<ConfirmedLocation | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // Tags belong to one project: drop the selection when the project changes.
  const [tagScope, setTagScope] = useState(workspaceId);
  if (tagScope !== workspaceId) {
    setTagScope(workspaceId);
    setSelectedTagIds([]);
  }

  const target = useMemo(
    () => ({ organizationId, workspaceId, projectName, canEdit, location: confirmed, tagIds: selectedTagIds }),
    [organizationId, workspaceId, projectName, canEdit, confirmed, selectedTagIds],
  );
  const { submit, receipt, failure, submitting, dismissReceipt } = useOnsitePlacement(target, tx);

  const run = async (capture: OnsiteCapture) => {
    await submit(capture);
    // Every placement needs its own explicit location confirmation.
    setConfirmed(null);
  };

  const pinned = !context.synced && workspaceId
    ? {
        label: tx("contentModel.integration.onsite.context.pinned"),
        projectName: projectName ?? tx("contentModel.integration.onsite.context.unknownProject"),
        clearLabel: tx("contentModel.integration.onsite.context.clear"),
        clearHref: "/upload-onsite",
      }
    : null;
  const captureDisabled = !confirmed || submitting;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-1">
          <Text as="h1" variant="headingLg" fontWeight="bold">
            {tx("onsite.title")}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">{tx("onsite.subtitle")}</Text>
        </header>

        <section className="space-y-3">
          <WorkspaceContextCard workspaceId={workspaceId} pinned={pinned} />
          <GPSStatusCard gpsPosition={gpsPosition} gpsError={gpsError} gpsLoading={gpsLoading}>
            {canEdit && (
              <LocationConfirm
                current={gpsError ? null : gpsPosition}
                confirmed={confirmed}
                onConfirm={setConfirmed}
                onClear={() => setConfirmed(null)}
                disabled={submitting}
              />
            )}
          </GPSStatusCard>
          <TagSelector workspaceId={workspaceId} selectedTagIds={selectedTagIds} onTagIdsChange={setSelectedTagIds} />
        </section>

        <OnsiteAccessNotice
          tx={tx}
          frozen={frozen}
          hasWorkspace={Boolean(workspaceId)}
          status={info.status}
          error={info.error}
          archived={archived}
          canEdit={canEdit}
          onRetry={info.refresh}
        />

        {receipt && <UploadReceiptCard receipt={receipt} onDismiss={dismissReceipt} />}

        {failure && (
          <ContentNotice
            tone="critical"
            title={tx("contentModel.integration.onsite.error.title")}
            description={<><p>{failure}</p><p>{tx("contentModel.integration.onsite.error.keepCapture")}</p></>}
          />
        )}

        {canEdit && (
          <section className="space-y-3">
            {!confirmed && (
              <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.onsite.location.required")}</Text>
            )}
            <ModeSelector mode={mode} onModeChange={setMode} />
            {mode === "camera" && (
              <CameraUpload
                onUpload={(source, title, description) => run({ kind: "image", source, title, description })}
                disabled={captureDisabled}
              />
            )}
            {mode === "text" && <TextUpload onUpload={(source) => run({ kind: "text", source })} disabled={captureDisabled} />}
            {mode === "audio" && (
              <AudioRecorder
                onUpload={(source, title, description) => run({ kind: "audio", source, title, description })}
                disabled={captureDisabled}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
