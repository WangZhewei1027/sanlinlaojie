"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import type { PinnedTargetOption } from "@/app/manage/content/types";
import { PlacementTargetSelect } from "@/app/manage/content/PlacementTargetSelect";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import type { PlacementDto, PlacementTargetInput } from "@/lib/content-model/contracts";
import { isLockConflict, placementApi, sceneApi } from "../../lib/content-api";
import { errorMessage } from "../../lib/content-errors";
import { placementScopeKey, placementSourceName } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";

interface PlacementRevisionSwitchProps {
  placement: PlacementDto & { target: Extract<PlacementDto["target"], { kind: "scene_revision" }> };
  editable: boolean;
  /** Unsaved field edits: switching would bump the lock under them. */
  formDirty: boolean;
}

/** Select a published scene layout. Asset content always follows its source. */
export function PlacementRevisionSwitch({ placement, editable, formDirty }: PlacementRevisionSwitchProps) {
  const { tx, organizationId, workspaceId } = usePlacementMap();
  const target = placement.target;
  const scopeKey = placementScopeKey(organizationId, workspaceId);
  const currentId = target.scene_revision_id;
  const [choice, setChoice] = useState(currentId);
  const [revisions, setRevisions] = useState<{ key: string; options: PinnedTargetOption[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const sceneId = target.kind === "scene_revision" ? target.scene_id : null;
  const revisionKey = `${scopeKey}|${sceneId}`;

  useEffect(() => setChoice(currentId), [currentId]);
  useEffect(() => {
    if (!sceneId || !editable) return;
    const abort = new AbortController();
    sceneApi
      .revisions(sceneId, abort.signal)
      .then((list) => {
        if (!abort.signal.aborted) setRevisions({ key: revisionKey, options: list.map((revision) => ({ id: revision.id, number: revision.revision_no, createdAt: revision.created_at })) });
      })
      .catch(() => {
        if (!abort.signal.aborted) setRevisions({ key: revisionKey, options: [] });
      });
    return () => abort.abort();
  }, [sceneId, revisionKey, editable]);

  const options: PinnedTargetOption[] = useMemo(() => {
    return revisions?.key === revisionKey && revisions.options.length ? revisions.options : [{ id: target.scene_revision_id, number: target.revision_no, createdAt: placement.updated_at }];
  }, [target, revisions, revisionKey, placement.updated_at]);

  const latestId = target.latest_revision_id;
  const latestNumber = options.find((option) => option.id === latestId)?.number ?? null;
  const canReadVersions = revisions?.key === revisionKey && !!revisions.options.length;
  const disabled = !editable || !canReadVersions || formDirty || pending;

  const apply = async (id: string) => {
    if (disabled || id === currentId) return;
    const next: PlacementTargetInput = { kind: "scene_revision", sceneRevisionId: id };
    setPending(true);
    setError(null);
    try {
      const updated = await placementApi.update(placement.id, { expectedLockVersion: placement.lock_version, target: next });
      usePlacementStore.getState().upsertPlacements([updated]);
    } catch (failure) {
      setError({ message: errorMessage(failure, tx), conflict: isLockConflict(failure) });
      setChoice(currentId);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <PlacementTargetSelect kind={target.kind} sourceName={placementSourceName(placement) ?? ""} options={options} value={choice} onChange={setChoice} disabled={disabled} />
      {editable && (
        <div className="flex flex-wrap gap-2">
          {choice !== currentId && (
            <Button size="sm" variant="secondary" disabled={disabled} onClick={() => apply(choice)}>
              {pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {tx("contentModel.integration.map.version.apply")}
            </Button>
          )}
          {target.upgrade_available && latestId && latestId !== currentId && choice === currentId && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => apply(latestId)}>
              <ArrowUpCircle className="size-4" aria-hidden />
              {tx("contentModel.integration.map.version.latestRevision", { number: latestNumber ?? "" })}
            </Button>
          )}
        </div>
      )}
      {editable && formDirty && <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.version.saveFirst")}</Text>}
      {error && (
        <ContentNotice
          tone="warning"
          title={error.message}
          action={error.conflict ? <Button size="sm" variant="outline" onClick={() => usePlacementStore.getState().requestReload()}>{tx("contentModel.integration.map.action.reload")}</Button> : undefined}
        />
      )}
    </div>
  );
}
