"use client";

import { useEffect, useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import type { Asset, Tag } from "../../types";
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

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const fetchTags = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setTags([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/tags?workspace_id=${selectedWorkspaceId}`
      );
      const result = await response.json();

      if (response.ok) {
        setTags(result.tags || []);
      }
    } catch (err) {
      console.error("获取标签失败:", err);
      setTags([]);
    }
  }, [selectedWorkspaceId]);

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
    fetchTags();
    fetchAssets();
  }, [fetchTags, fetchAssets]);

  // 过滤资产：如果选中了标签，只显示包含这些标签的资产
  const filteredAssets =
    selectedTagIds.length === 0
      ? assets
      : assets.filter((asset) => {
          if (!asset.tag_ids || asset.tag_ids.length === 0) return false;
          // 资产必须包含至少一个选中的标签
          return selectedTagIds.some((tagId) => asset.tag_ids?.includes(tagId));
        });

  if (loading) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card className="overflow-hidden">
      <AssetListHeader
        totalCount={assets.length}
        filteredCount={filteredAssets.length}
        tags={tags}
        selectedTagIds={selectedTagIds}
        onTagsChange={setSelectedTagIds}
      />

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {filteredAssets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>没有符合筛选条件的资产</p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              tags={tags}
              onFocusAsset={onFocusAsset}
            />
          ))
        )}
      </div>
    </Card>
  );
}

// 导出 API 方法供其他组件使用
export function useAssetAPI() {
  const updateAssetInStore = useManageStore((state) => state.updateAsset);
  const deleteAssetInStore = useManageStore((state) => state.deleteAsset);

  const handleUpdateAsset = async (
    assetId: string,
    updates: Partial<Asset>
  ) => {
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

      updateAssetInStore(assetId, result.data);
      return result.data;
    } catch (err) {
      console.error("更新资源失败:", err);
      throw err;
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "删除资源失败");
      }

      deleteAssetInStore(assetId);
      return result;
    } catch (err) {
      console.error("删除资源失败:", err);
      throw err;
    }
  };

  return { handleUpdateAsset, handleDeleteAsset };
}
