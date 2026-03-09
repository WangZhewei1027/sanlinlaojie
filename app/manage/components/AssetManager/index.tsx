"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { Asset, Tag, Creator } from "../../types";
import { useManageStore } from "../../store";
import { AssetCard } from "./AssetCard";
import { AssetListHeader } from "./AssetListHeader";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

interface AssetManagerProps {
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetManager({ onFocusAsset }: AssetManagerProps) {
  const { t } = useTranslation();
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId,
  );
  const assets = useManageStore((state) => state.assets);
  const loading = useManageStore((state) => state.assetsLoading);
  const setAssets = useManageStore((state) => state.setAssets);
  const setFilteredAssets = useManageStore((state) => state.setFilteredAssets);
  const setAssetsLoading = useManageStore((state) => state.setAssetsLoading);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);

  const fetchTags = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setTags([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/tags?workspace_id=${selectedWorkspaceId}`,
      );
      const result = await response.json();

      if (response.ok) {
        setTags(result.tags || []);
      }
    } catch (err) {
      console.error(t("assetManager.fetchTagsFailed"), err);
      setTags([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  const fetchCreators = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setCreators([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/workspaces/${selectedWorkspaceId}/assets/creators`,
      );
      const result = await response.json();

      if (response.ok) {
        setCreators(result.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch creators:", err);
      setCreators([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  const fetchAssets = useCallback(async () => {
    if (!selectedWorkspaceId) {
      setAssets([]);
      return;
    }

    setAssetsLoading(true);

    try {
      const response = await fetch(
        `/api/workspaces/${selectedWorkspaceId}/assets`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("assetManager.fetchAssetsFailed"));
      }

      setAssets(result.data || []);
    } catch (err) {
      console.error(t("assetManager.fetchAssetsFailed"), err);
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, setAssets, setAssetsLoading]);

  useEffect(() => {
    fetchTags();
    fetchAssets();
    fetchCreators();
  }, [fetchTags, fetchAssets, fetchCreators]);

  // 从当前 assets 中派生出可用的 file_type 列表
  const availableFileTypes = useMemo(() => {
    return [...new Set(assets.map((a) => a.file_type))].sort();
  }, [assets]);

  // 过滤资产：tag、user、file_type 过滤条件为 AND 关系；同一类型内部为 OR
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // tag 过滤
      if (selectedTagIds.length > 0) {
        if (!asset.tag_ids || asset.tag_ids.length === 0) return false;
        if (!selectedTagIds.some((tagId) => asset.tag_ids?.includes(tagId)))
          return false;
      }
      // user 过滤
      if (selectedUserIds.length > 0) {
        if (!asset.created_by || !selectedUserIds.includes(asset.created_by))
          return false;
      }
      // file_type 过滤
      if (selectedFileTypes.length > 0) {
        if (!selectedFileTypes.includes(asset.file_type)) return false;
      }
      return true;
    });
  }, [assets, selectedTagIds, selectedUserIds, selectedFileTypes]);

  // 将过滤后的结果同步到store，供viewer使用
  useEffect(() => {
    setFilteredAssets(filteredAssets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assets,
    selectedTagIds,
    selectedUserIds,
    selectedFileTypes,
    setFilteredAssets,
  ]);

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
        creators={creators}
        selectedUserIds={selectedUserIds}
        onUsersChange={setSelectedUserIds}
        fileTypes={availableFileTypes}
        selectedFileTypes={selectedFileTypes}
        onFileTypesChange={setSelectedFileTypes}
        onRefresh={() => {
          fetchTags();
          fetchAssets();
          fetchCreators();
        }}
        refreshing={loading}
      />

      <div className="divide-y w-full overflow-y-auto max-h-[calc(100vh-200px)]">
        {filteredAssets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>{t("assetManager.noMatchingAssets")}</p>
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
  const { t } = useTranslation();
  const updateAssetInStore = useManageStore((state) => state.updateAsset);
  const deleteAssetInStore = useManageStore((state) => state.deleteAsset);

  const handleUpdateAsset = async (
    assetId: string,
    updates: Partial<Asset>,
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
        throw new Error(result.error || t("assetManager.updateAssetFailed"));
      }

      updateAssetInStore(assetId, result.data);
      return result.data;
    } catch (err) {
      console.error(t("assetManager.updateAssetFailed"), err);
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
        throw new Error(result.error || t("assetManager.deleteAssetFailed"));
      }

      deleteAssetInStore(assetId);
      return result;
    } catch (err) {
      console.error(t("assetManager.deleteAssetFailed"), err);
      throw err;
    }
  };

  return { handleUpdateAsset, handleDeleteAsset };
}
