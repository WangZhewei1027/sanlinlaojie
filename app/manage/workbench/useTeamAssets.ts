"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiPage, AssetDto, AssetFileType, AssetListQuery } from "@/lib/content-model/contracts";
import type { ContentLifecycle } from "@/app/manage/content/types";
import { organizationApi } from "@/app/manage/lib/content-api";

export const ASSET_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface ListRequest {
  organizationId: string;
  query: AssetListQuery;
}

interface ListState {
  stamp: string;
  rows: AssetDto[];
  /** Raw rows received so far (paging offset), before library filtering. */
  fetched: number;
  total: number | null;
  lastPageSize: number;
  error: unknown;
  loadingMore: boolean;
  moreError: unknown;
}

export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fetchPage(request: ListRequest, offset: number, signal: AbortSignal): Promise<ApiPage<AssetDto>> {
  return organizationApi.assets(request.organizationId, { ...request.query, offset }, signal);
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Every asset of the team (`view=all`), newest change first, paged. Filter
 * changes start over at offset 0 and abort whatever is in flight; "load
 * more" appends.
 */
export function useTeamAssets(input: {
  organizationId: string | null;
  query: string;
  fileType: AssetFileType | null;
  state: ContentLifecycle;
  enabled: boolean;
}) {
  const { organizationId, fileType, state: lifecycle, enabled } = input;
  const q = useDebouncedValue(input.query.trim(), SEARCH_DEBOUNCE_MS);
  const request = useMemo<ListRequest | null>(() => {
    if (!enabled || !organizationId) return null;
    const query: AssetListQuery = { view: "all", q: q || undefined, file_type: fileType ?? undefined, state: lifecycle, limit: ASSET_PAGE_SIZE };
    return { organizationId, query };
  }, [enabled, organizationId, q, fileType, lifecycle]);

  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<ListState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stamp = request ? `${JSON.stringify(request)}#${nonce}` : null;

  useEffect(() => {
    abortRef.current?.abort();
    if (!request || !stamp) return;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchPage(request, 0, controller.signal)
      .then((page) => {
        const rows = page.data ?? [];
        setState({ stamp, rows, fetched: rows.length, total: page.page?.total ?? null, lastPageSize: rows.length, error: null, loadingMore: false, moreError: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setState({ stamp, rows: [], fetched: 0, total: null, lastPageSize: 0, error, loadingMore: false, moreError: null });
      });
    return () => controller.abort();
  }, [request, stamp]);

  const current = state && state.stamp === stamp ? state : null;

  const loadMore = useCallback(() => {
    if (!request || !current || current.error || current.loadingMore) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const at = current.stamp;
    setState((prev) => (prev && prev.stamp === at ? { ...prev, loadingMore: true, moreError: null } : prev));
    fetchPage(request, current.fetched, controller.signal)
      .then((page) => {
        const rows = page.data ?? [];
        setState((prev) => {
          if (!prev || prev.stamp !== at) return prev;
          const seen = new Set(prev.rows.map((row) => row.id));
          return {
            ...prev,
            rows: [...prev.rows, ...rows.filter((row) => !seen.has(row.id))],
            fetched: prev.fetched + rows.length,
            total: page.page?.total ?? prev.total,
            lastPageSize: rows.length,
            loadingMore: false,
          };
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setState((prev) => (prev && prev.stamp === at ? { ...prev, loadingMore: false, moreError: error } : prev));
      });
  }, [request, current]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const status: "loading" | "ready" | "error" = !request ? "ready" : !current ? "loading" : current.error ? "error" : "ready";
  const hasMore = !!current && !current.error && (current.total !== null ? current.fetched < current.total : current.lastPageSize === ASSET_PAGE_SIZE);
  return {
    status,
    rows: current?.rows ?? [],
    total: current?.total ?? null,
    error: current?.error ?? null,
    hasMore,
    loadingMore: current?.loadingMore ?? false,
    moreError: current?.moreError ?? null,
    loadMore,
    reload,
  };
}
