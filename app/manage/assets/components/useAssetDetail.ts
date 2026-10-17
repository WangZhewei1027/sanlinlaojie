"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetDetailDto, AssetDto, AssetUsageDto } from "@/lib/content-model/contracts";
import { assetApi } from "@/app/manage/lib/content-api";

interface Slot<T> {
  key: string;
  data: T | null;
  error: unknown;
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Asset detail and its usage, loaded independently so a slow or failing usage
 * query never blocks the identity, versions or sharing panels. Reloads keep
 * the previous data on screen; `lockVersion` always holds the latest lock seen.
 */
export function useAssetDetail(assetId: string) {
  const [asset, setAsset] = useState<Slot<AssetDetailDto> | null>(null);
  const [usage, setUsage] = useState<Slot<AssetUsageDto> | null>(null);
  const lockRef = useRef<number | null>(null);

  const loadAsset = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await assetApi.get(assetId, signal);
      lockRef.current = data.lock_version;
      setAsset({ key: assetId, data, error: null });
    } catch (error) {
      if (signal?.aborted || isAbort(error)) return;
      setAsset((prev) => ({ key: assetId, data: prev?.key === assetId ? prev.data : null, error }));
    }
  }, [assetId]);

  const loadUsage = useCallback(async (signal?: AbortSignal) => {
    setUsage((prev) => (prev?.key === assetId && prev.error ? { ...prev, error: null, data: null } : prev));
    try {
      const data = await assetApi.usage(assetId, signal);
      setUsage({ key: assetId, data, error: null });
    } catch (error) {
      if (signal?.aborted || isAbort(error)) return;
      setUsage((prev) => ({ key: assetId, data: prev?.key === assetId ? prev.data : null, error }));
    }
  }, [assetId]);

  useEffect(() => {
    const controller = new AbortController();
    lockRef.current = null;
    void loadAsset(controller.signal);
    void loadUsage(controller.signal);
    return () => controller.abort();
  }, [loadAsset, loadUsage]);

  /** Apply the identity row a write returned (new lock) before the full reload lands. */
  const applyAsset = useCallback((next: AssetDto) => {
    lockRef.current = next.lock_version;
    setAsset((prev) => (prev?.key === assetId && prev.data ? { ...prev, data: { ...prev.data, ...next } } : prev));
  }, [assetId]);

  const refresh = useCallback(() => Promise.all([loadAsset(), loadUsage()]).then(() => undefined), [loadAsset, loadUsage]);

  const currentAsset = asset?.key === assetId ? asset : null;
  const currentUsage = usage?.key === assetId ? usage : null;
  return {
    asset: currentAsset?.data ?? null,
    assetError: currentAsset?.error ?? null,
    assetStatus: currentAsset?.data ? "ready" : currentAsset?.error ? "error" : "loading",
    usage: currentUsage?.data ?? null,
    usageStatus: currentUsage?.data ? "ready" : currentUsage?.error ? "error" : "loading",
    usageError: currentUsage?.error ?? null,
    /** Latest lock version seen (reads or write results). */
    lockVersion: () => lockRef.current ?? currentAsset?.data?.lock_version ?? 0,
    applyAsset,
    refresh,
    retryAsset: () => void loadAsset(),
    retryUsage: () => void loadUsage(),
  } as const;
}
