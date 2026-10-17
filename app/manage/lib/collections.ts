"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceDto } from "@/lib/content-model/contracts";
import { organizationApi, type CollectionState } from "./content-api";

export interface CollectionListState {
  status: "idle" | "loading" | "ready" | "error";
  collections: WorkspaceDto[];
  error: unknown;
  reload: () => void;
}

/**
 * Map collections of one team. Only the collections page, the map detail and
 * the onsite target picker read this list; content authoring never does.
 */
export function useCollections(organizationId: string | null, state: CollectionState, enabled = true): CollectionListState {
  const [result, setResult] = useState<{ key: string; collections: WorkspaceDto[]; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = enabled && organizationId ? `${organizationId}|${state}` : null;

  useEffect(() => {
    if (!key || !organizationId) return;
    const abort = new AbortController();
    organizationApi.collections(organizationId, { state }, abort.signal)
      .then((collections) => setResult({ key, collections, error: null }))
      .catch((error) => {
        if (!abort.signal.aborted) setResult({ key, collections: [], error });
      });
    return () => abort.abort();
  }, [key, organizationId, state, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  if (!key) return { status: "idle", collections: [], error: null, reload };
  const current = result?.key === key ? result : null;
  if (!current) return { status: "loading", collections: [], error: null, reload };
  return { status: current.error ? "error" : "ready", collections: current.collections, error: current.error, reload };
}
