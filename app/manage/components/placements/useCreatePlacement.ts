"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { CaptureMetadata, CreatePlacementRequest, GeoPointInput, PlacementDto } from "@/lib/content-model/contracts";
import { newIdempotencyKey, workspaceApi } from "../../lib/content-api";
import { errorMessage } from "../../lib/content-errors";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";
import { parseNumber } from "./placement-utils";

export interface LocationInput {
  longitude: string;
  latitude: string;
  altitude: string;
}

export const EMPTY_LOCATION: LocationInput = { longitude: "", latitude: "", altitude: "" };

/** "" everywhere → null; partial or out-of-range → "invalid". */
export function parseLocation(input: LocationInput): GeoPointInput | null | "invalid" {
  const longitude = parseNumber(input.longitude);
  const latitude = parseNumber(input.latitude);
  const altitude = parseNumber(input.altitude);
  if (longitude === null && latitude === null && altitude === null) return null;
  if (longitude === null || latitude === null || Number.isNaN(longitude) || Number.isNaN(latitude) || Number.isNaN(altitude)) return "invalid";
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return "invalid";
  return { longitude, latitude, altitude };
}

/** Capture GPS → location inputs (only when the user explicitly asks for it). */
export function locationFromCapture(capture: CaptureMetadata | undefined): LocationInput | null {
  if (capture?.longitude === undefined || capture.latitude === undefined) return null;
  return { longitude: String(capture.longitude), latitude: String(capture.latitude), altitude: capture.altitude !== undefined ? String(capture.altitude) : "" };
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CreateBody = DistributiveOmit<CreatePlacementRequest, "idempotencyKey">;

/**
 * Submits one create intent. The idempotency key lives as long as the intent:
 * a retry with an identical body replays the same key; a changed body,
 * `resetIntent` or a success starts a new one.
 */
export function useCreatePlacement() {
  const { tx, workspaceId, focusPlacement } = usePlacementMap();
  const key = useRef(newIdempotencyKey());
  const lastBody = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetIntent = useCallback(() => {
    key.current = newIdempotencyKey();
    lastBody.current = null;
    setError(null);
  }, []);

  /** `prepare` runs inside the pending state (uploads) and returns the request body. */
  const submit = useCallback(
    async (prepare: () => Promise<CreateBody>): Promise<PlacementDto | null> => {
      if (!workspaceId) return null;
      setPending(true);
      setError(null);
      try {
        const body = await prepare();
        // A changed body is a new intent; an identical one (retry) replays the key.
        const json = JSON.stringify(body);
        if (lastBody.current !== null && lastBody.current !== json) key.current = newIdempotencyKey();
        lastBody.current = json;
        const result = await workspaceApi.createPlacement(workspaceId, { ...body, idempotencyKey: key.current } as CreatePlacementRequest);
        const placement = result.placement;
        usePlacementStore.getState().upsertPlacements([placement]);
        focusPlacement(placement);
        toast.success(tx("contentModel.integration.map.create.done"));
        key.current = newIdempotencyKey();
        lastBody.current = null;
        return placement;
      } catch (failure) {
        setError(errorMessage(failure, tx));
        return null;
      } finally {
        setPending(false);
      }
    },
    [workspaceId, focusPlacement, tx],
  );

  return { submit, pending, error, setError, resetIntent };
}
