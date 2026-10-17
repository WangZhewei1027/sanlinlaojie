"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { PlacementDto } from "@/lib/content-model/contracts";
import { isLockConflict, newIdempotencyKey, placementApi } from "../../lib/content-api";
import { errorMessage } from "../../lib/content-errors";
import { placementDisplayName } from "../../lib/placement-to-viewer";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";

export interface BulkFailure {
  placement: PlacementDto;
  message: string;
}

export interface BulkResult {
  done: PlacementDto[];
  failed: BulkFailure[];
}

const COPY_OFFSET_METERS = 2;

/**
 * Copy ("另处投放") and archive ("移除投放") for one or many placements.
 * Each item is its own request; partial failures are summarized, never hidden.
 * Callers pass only rows the capabilities allow — the server re-checks.
 */
export function usePlacementActions() {
  const { tx, workspaceId, isAll } = usePlacementMap();

  const summarize = useCallback(
    (kind: "copy" | "archive", result: BulkResult) => {
      if (result.failed.length === 0) {
        toast.success(tx(`contentModel.integration.map.${kind}.done`, { count: result.done.length }));
        return;
      }
      const names = result.failed.slice(0, 3).map((item) => `${placementDisplayName(item.placement)}: ${item.message}`);
      toast.error(tx(`contentModel.integration.map.${kind}.partial`, { done: result.done.length, failed: result.failed.length }), {
        description: names.join("\n"),
      });
    },
    [tx],
  );

  const run = useCallback(
    async (placements: PlacementDto[], task: (placement: PlacementDto) => Promise<PlacementDto>): Promise<BulkResult> => {
      const settled = await Promise.allSettled(placements.map(task));
      const result: BulkResult = { done: [], failed: [] };
      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") result.done.push(outcome.value);
        else result.failed.push({ placement: placements[index], message: errorMessage(outcome.reason, tx) });
      });
      if (settled.some((outcome) => outcome.status === "rejected" && isLockConflict(outcome.reason))) usePlacementStore.getState().requestReload();
      return result;
    },
    [tx],
  );

  /** Copies into `targetWorkspaceId` (default: the current project), 2 m offset. */
  const copy = useCallback(
    async (placements: PlacementDto[], targetWorkspaceId: string) => {
      const result = await run(placements, (placement) =>
        placementApi
          .copy(placement.id, { targetWorkspaceId, offsetMeters: COPY_OFFSET_METERS, idempotencyKey: newIdempotencyKey() })
          .then((created) => created.placement),
      );
      // Copies into another project do not belong to the list being shown.
      if (isAll || targetWorkspaceId === workspaceId) usePlacementStore.getState().upsertPlacements(result.done);
      summarize("copy", result);
      return result;
    },
    [run, summarize, isAll, workspaceId],
  );

  const archive = useCallback(
    async (placements: PlacementDto[]) => {
      const result = await run(placements, (placement) => placementApi.archive(placement.id, placement.lock_version));
      const store = usePlacementStore.getState();
      store.upsertPlacements(result.done);
      const archivedIds = new Set(result.done.map((placement) => placement.id));
      if (store.selectedPlacementId && archivedIds.has(store.selectedPlacementId) && store.statusFilter === "current") store.selectPlacement(null);
      store.setSelectedPlacementIds(store.selectedPlacementIds.filter((id) => !archivedIds.has(id)));
      summarize("archive", result);
      return result;
    },
    [run, summarize],
  );

  return { copy, archive };
}
