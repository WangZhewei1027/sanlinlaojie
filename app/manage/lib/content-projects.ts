"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkspaceDto } from "@/lib/content-model/contracts";
import { workspaceApi } from "./content-api";

const cache = new Map<string, { at: number; dto: WorkspaceDto | null }>();
const TTL_MS = 30_000;

/**
 * Server capabilities for several projects (copy/duplicate targets). Each
 * project is asked individually; a failure or legacy shape counts as "not
 * writable" rather than guessing from organization roles.
 */
export function useProjectCapabilities(workspaceIds: string[]) {
  const key = workspaceIds.join(",");
  const [state, setState] = useState<{ key: string; byId: Map<string, WorkspaceDto | null> } | null>(null);

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    let cancelled = false;
    (async () => {
      const byId = new Map<string, WorkspaceDto | null>();
      const queue = [...ids];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const hit = cache.get(next);
          if (hit && Date.now() - hit.at < TTL_MS) { byId.set(next, hit.dto); continue; }
          const dto = await workspaceApi.info(next).catch(() => null);
          cache.set(next, { at: Date.now(), dto });
          byId.set(next, dto);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
      if (!cancelled) setState({ key, byId });
    })();
    return () => { cancelled = true; };
  }, [key]);

  return useMemo(() => {
    const byId = state?.key === key ? state.byId : new Map<string, WorkspaceDto | null>();
    const writable = [...byId.values()].filter((dto): dto is WorkspaceDto => !!dto && dto.capabilities.can_edit && !dto.archived_at);
    return { byId, writable, loaded: state?.key === key };
  }, [state, key]);
}
