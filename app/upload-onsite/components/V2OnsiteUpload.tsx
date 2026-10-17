"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Text } from "@/components/ui/typography";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { isSpecificWorkspaceId } from "@/app/manage/constants";
import { useCollections } from "@/app/manage/lib/collections";
import { type TeamContext, teamHref, useCollectionInfo } from "@/app/manage/lib/content-context";
import { errorMessage } from "@/app/manage/lib/content-errors";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { useGPS } from "../hooks/useGPS";
import { type OnsiteCapture, useOnsitePlacement } from "../hooks/useOnsitePlacement";
import { ONSITE_TEXTS } from "../onsite-texts";
import { AudioRecorder } from "./AudioRecorder";
import { CameraUpload } from "./CameraUpload";
import { CollectionTargetCard } from "./CollectionTargetCard";
import { GPSStatusCard } from "./GPSStatusCard";
import { type ConfirmedLocation, LocationConfirm } from "./LocationConfirm";
import { ModeSelector } from "./ModeSelector";
import { TagSelector } from "./TagSelector";
import { TextUpload } from "./TextUpload";
import { UploadReceiptCard } from "./UploadReceiptCard";
import { OnsiteAccessNotice } from "./OnsiteAccessNotice";

type UploadMode = "camera" | "text" | "audio";

/**
 * Onsite capture for teams on content model v2: a map collection chosen on
 * this page (or by the link's `collectionId`/`workspaceId`), its server-side
 * edit capability, a confirmed device location, then one "upload and place"
 * command that returns a fixed-version receipt.
 */
export function V2OnsiteUpload({ team, frozen }: { team: TeamContext; frozen: boolean }) {
  const tx = useIntegrationText(ONSITE_TEXTS);
  const params = useSearchParams();
  const { gpsPosition, gpsError, gpsLoading } = useGPS();
  const { organizationId } = team;
  const list = useCollections(organizationId, "active");
  const linked = [params.get("collectionId"), params.get("workspaceId")].find(isSpecificWorkspaceId) ?? null;

  // The pick belongs to one team: switching team starts over.
  const [picked, setPicked] = useState<{ team: string | null; id: string } | null>(null);
  // A link that names a collection is never swapped for another one: if it is
  // archived or gone, the user must pick deliberately. Only a page without a
  // named target auto-selects the team's sole active collection.
  const linkedValid = !!linked && list.collections.some((item) => item.id === linked);
  const linkedInvalid = !!linked && list.status === "ready" && !linkedValid;
  const fallback = linked ? (linkedValid ? linked : null) : list.collections.length === 1 ? list.collections[0].id : null;
  const collectionId = picked?.team === organizationId ? picked.id : fallback;
  const info = useCollectionInfo(collectionId);
  const collection = info.collection;
  const collectionName = collection?.name ?? list.collections.find((item) => item.id === collectionId)?.name ?? null;
  const archived = Boolean(collection?.archived_at);
  const canEdit = !frozen && !archived && collection?.capabilities.can_edit === true;

  const [mode, setMode] = useState<UploadMode>("camera");
  const [confirmed, setConfirmed] = useState<ConfirmedLocation | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // Tags belong to one collection: drop the selection when it changes.
  const [tagScope, setTagScope] = useState(collectionId);
  if (tagScope !== collectionId) {
    setTagScope(collectionId);
    setSelectedTagIds([]);
  }

  const target = useMemo(
    () => ({ organizationId, workspaceId: collectionId, collectionName, canEdit, location: confirmed, tagIds: selectedTagIds }),
    [organizationId, collectionId, collectionName, canEdit, confirmed, selectedTagIds],
  );
  const { submit, receipt, failure, submitting, dismissReceipt } = useOnsitePlacement(target, tx);

  const run = async (capture: OnsiteCapture) => {
    await submit(capture);
    // Every placement needs its own explicit location confirmation.
    setConfirmed(null);
  };
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
          <CollectionTargetCard
            tx={tx}
            status={list.status}
            error={list.error ? errorMessage(list.error, tx) : null}
            onRetry={list.reload}
            collections={list.collections}
            value={collectionId}
            linkedInvalid={linkedInvalid && !collectionId}
            onChange={(id) => setPicked({ team: organizationId, id })}
            createHref={teamHref("/manage/collections", organizationId)}
          />
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
          <TagSelector workspaceId={collectionId} selectedTagIds={selectedTagIds} onTagIdsChange={setSelectedTagIds} />
        </section>

        <OnsiteAccessNotice
          tx={tx}
          frozen={frozen}
          hasCollection={Boolean(collectionId)}
          status={info.status}
          error={info.error ? errorMessage(info.error, tx) : null}
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
