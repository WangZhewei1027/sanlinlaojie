import { useState, useEffect, useCallback } from "react";
import type { Asset } from "../types";

export function useAssets(workspaceId: string | null) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!workspaceId) {
      setAssets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/assets`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取资源失败");
      }

      setAssets(result.data || []);
    } catch (err) {
      console.error("获取 assets 失败:", err);
      setError(err instanceof Error ? err.message : "获取资源失败");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const refetch = useCallback(() => {
    return fetchAssets();
  }, [fetchAssets]);

  return {
    assets,
    loading,
    error,
    refetch,
  };
}
