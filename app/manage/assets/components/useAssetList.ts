"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiPage, AssetDto, AssetListQuery } from "@/lib/content-model/contracts";
import type { AssetLibraryFilters, AssetLibraryScope } from "@/app/manage/content/types";
import { organizationApi, workspaceApi } from "@/app/manage/lib/content-api";

export const ASSET_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface ListRequest {
  scope: AssetLibraryScope;
  organizationId: string;
  workspaceId: string | null;
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

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fetchPage(request: ListRequest, offset: number, signal: AbortSignal): Promise<ApiPage<AssetDto>> {
  const query = { ...request.query, offset };
  return request.scope === "project" && request.workspaceId
    ? workspaceApi.assets(request.workspaceId, query, signal)
    : organizationApi.assets(request.organizationId, query, signal);
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Paged asset list for one scope. Filter or scope changes start over at
 * offset 0 and abort whatever is in flight; "load more" appends.
 */
export function useAssetList(input: {
  scope: AssetLibraryScope;
  organizationId: string | null;
  workspaceId: string | null;
  filters: AssetLibraryFilters;
  enabled: boolean;
}) {
  const { scope, organizationId, workspaceId, filters, enabled } = input;
  const q = useDebouncedValue(filters.query.trim(), SEARCH_DEBOUNCE_MS);
  const request = useMemo<ListRequest | null>(() => {
    if (!enabled || !organizationId) return null;
    if (scope === "project" && !workspaceId) return null;
    const query: AssetListQuery = {
      q: q || undefined,
      file_type: filters.type === "all" ? undefined : filters.type,
      origin: filters.origin === "all" ? undefined : filters.origin,
      state: filters.state,
      limit: ASSET_PAGE_SIZE,
    };
    if (scope === "organization") Object.assign(query, { view: "shared", usable_in: workspaceId ?? undefined });
    return { scope, organizationId, workspaceId, query };
  }, [enabled, organizationId, workspaceId, scope, q, filters.type, filters.origin, filters.state]);

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
