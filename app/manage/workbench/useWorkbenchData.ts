"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetFileType, SceneSummaryDto } from "@/lib/content-model/contracts";
import type { WorkbenchFilters, WorkbenchItem } from "@/app/manage/content/types";
import { organizationApi } from "@/app/manage/lib/content-api";
import { isLibraryAsset, toWorkbenchAsset, toWorkbenchScene } from "@/app/manage/lib/content-mappers";
import { useTeamAssets } from "./useTeamAssets";

const NO_PEOPLE = new Map();

/** Team scenes for one lifecycle state; the list is small and not paged. */
function useTeamScenes(organizationId: string | null, state: WorkbenchFilters["state"], enabled: boolean) {
  const key = enabled && organizationId ? `${organizationId}|${state}` : null;
  const [result, setResult] = useState<{ key: string; scenes: SceneSummaryDto[]; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!key || !organizationId) return;
    const abort = new AbortController();
    organizationApi.scenes(organizationId, { state }, abort.signal)
      .then((list) => setResult({ key, scenes: list.items, error: null }))
      .catch((error) => { if (!abort.signal.aborted) setResult({ key, scenes: [], error }); });
    return () => abort.abort();
  }, [key, organizationId, state, nonce]);
  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const current = result?.key === key ? result : null;
  return {
    status: !key ? ("ready" as const) : !current ? ("loading" as const) : current.error ? ("error" as const) : ("ready" as const),
    scenes: current?.scenes ?? [],
    error: current?.error ?? null,
    reload,
  };
}

/**
 * Assets (paged, server-filtered) and scenes (client-filtered) merged into
 * one newest-first list. While older assets are still unloaded, scenes older
 * than the last loaded asset wait, so "load more" never reorders the grid.
 */
export function useWorkbenchData(organizationId: string | null, filters: WorkbenchFilters, enabled: boolean) {
  const wantsScenes = filters.type === "all" || filters.type === "scene";
  const wantsAssets = filters.type !== "scene";
  const assets = useTeamAssets({
    organizationId,
    query: filters.query,
    fileType: filters.type === "all" || filters.type === "scene" ? null : (filters.type as AssetFileType),
    state: filters.state,
    enabled: enabled && wantsAssets,
  });
  const scenes = useTeamScenes(organizationId, filters.state, enabled && wantsScenes);

  const items = useMemo<WorkbenchItem[]>(() => {
    const assetItems = wantsAssets ? assets.rows.filter(isLibraryAsset).map((row) => toWorkbenchAsset(row)) : [];
    if (!wantsScenes) return assetItems;
    const query = filters.query.trim().toLowerCase();
    const sceneItems = scenes.scenes
      .filter((scene) => scene.state === filters.state && (!query || scene.name.toLowerCase().includes(query)))
      .map((scene) => toWorkbenchScene(scene, NO_PEOPLE));
    if (!wantsAssets) return sceneItems;
    const cutoff = assets.hasMore && assetItems.length ? assetItems[assetItems.length - 1].updatedAt : null;
    return [...assetItems, ...sceneItems.filter((scene) => !cutoff || scene.updatedAt >= cutoff)]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }, [assets.rows, assets.hasMore, scenes.scenes, wantsAssets, wantsScenes, filters.query, filters.state]);

  const sceneCount = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return scenes.scenes.filter((scene) => scene.state === filters.state && (!query || scene.name.toLowerCase().includes(query))).length;
  }, [scenes.scenes, filters.query, filters.state]);

  const assetsLoading = wantsAssets && assets.status === "loading";
  const scenesLoading = wantsScenes && scenes.status === "loading";
  const error = (wantsAssets && assets.error) || (wantsScenes && scenes.error) || null;
  const { reload: reloadAssets } = assets;
  const { reload: reloadScenes } = scenes;
  const reload = useCallback(() => { reloadAssets(); reloadScenes(); }, [reloadAssets, reloadScenes]);
  const assetTotal = wantsAssets ? assets.total : 0;

  return {
    status: error ? ("error" as const) : assetsLoading || scenesLoading ? ("loading" as const) : ("ready" as const),
    error,
    items,
    total: assetTotal === null ? undefined : assetTotal + (wantsScenes ? sceneCount : 0),
    hasMore: wantsAssets && assets.hasMore,
    loadingMore: assets.loadingMore,
    moreError: assets.moreError,
    loadMore: assets.loadMore,
    reload,
    reloadScenes,
    /** Latest lock version of a scene, for archive/restore. */
    sceneLock: (sceneId: string) => scenes.scenes.find((scene) => scene.id === sceneId)?.lock_version ?? 0,
  };
}
