"use client";

import { useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import type { Asset } from "../../types";
import { useManageStore } from "../../store";
import { AssetCard } from "./AssetCard";
import { AssetListHeader } from "./AssetListHeader";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

interface AssetManagerProps {
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetManager({ onFocusAsset }: AssetManagerProps) {
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId
  );
  const assets = useManageStore((state) => state.assets);
  const loading = useManageStore((state) => state.assetsLoading);
  const setAssets = useManageStore((state) => state.setAssets);
  const setAssetsLoading = useManageStore((state) => state.setAssetsLoading);
  const updateAssetInStore = useManageStore((state) => state.updateAsset);
  const deleteAssetInStore = useManageStore((state) => state.deleteAsset);

  const fetchAssets = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setAssets([]);
      return;
    }

    setAssetsLoading(true);

    try {
      const response = await fetch(
        `/api/workspaces/${selectedWorkspaceId}/assets`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "获取资源失败");
      }

      setAssets(result.data || []);
    } catch (err) {
      console.error("获取 assets 失败:", err);
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [selectedWorkspaceId, setAssets, setAssetsLoading]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUpdateAsset = useCallback(
    async (assetId: string, updates: Partial<Asset>) => {
      try {
        const response = await fetch(`/api/assets/${assetId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "更新资源失败");
        }

        // 更新 store 中的状态
        updateAssetInStore(assetId, result.data);

        return result.data;
      } catch (err) {
        console.error("更新资源失败:", err);
        throw err;
      }
    },
    [updateAssetInStore]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      try {
        const response = await fetch(`/api/assets/${assetId}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "删除资源失败");
        }

        // 从 store 中移除
        deleteAssetInStore(assetId);

        return result;
      } catch (err) {
        console.error("删除资源失败:", err);
        throw err;
      }
    },
    [deleteAssetInStore]
  );

  if (loading) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <AssetListHeader totalCount={assets.length} />

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onFocusAsset={onFocusAsset}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
          />
        ))}
      </div>
    </Card>
  );
}
