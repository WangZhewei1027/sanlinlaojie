"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import { useManageStore } from "../store";
import type { Asset } from "../types";

interface MapSelectionBarProps {
  /** 清除 viewer 端的选中高亮 */
  clearViewerSelection: () => void;
}

/**
 * 地图选中操作条：框选/多选后浮在 viewer 面板上方，提供复制 / 删除 / 取消。
 * viewer 角色（只读）不显示写操作。
 */
export function MapSelectionBar({ clearViewerSelection }: MapSelectionBarProps) {
  const { t } = useTranslation();
  const selectedAssetIds = useManageStore((state) => state.selectedAssetIds);
  const clearSelectedAssetIds = useManageStore(
    (state) => state.clearSelectedAssetIds,
  );
  const assets = useManageStore((state) => state.assets);
  const setAssets = useManageStore((state) => state.setAssets);
  const deleteAssetInStore = useManageStore((state) => state.deleteAsset);
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );

  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isViewer = (selectedOrganization?.role ?? null) === "viewer";
  const count = selectedAssetIds.length;

  if (count === 0) return null;

  const clearAll = () => {
    clearSelectedAssetIds();
    clearViewerSelection();
  };

  const handleCopy = async () => {
    if (count === 0) return;
    setCopying(true);
    try {
      const result = await fetchJson<{ data: Asset[] }>("/api/assets/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedAssetIds }),
      });
      const created = result.data ?? [];
      setAssets([...assets, ...created]);
      toast.success(t("manage.mapSelection.copied", { count: created.length }));
      clearAll();
    } catch {
      // fetchJson 已弹出错误 toast
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = async () => {
    if (count === 0) return;
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedAssetIds.map(async (id) => {
          await fetchJson(`/api/assets/${id}`, { method: "DELETE" });
          return id;
        }),
      );
      const succeeded = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<string>).value);
      succeeded.forEach((id) => deleteAssetInStore(id));

      const failed = count - succeeded.length;
      if (failed > 0) {
        toast.error(t("manage.mapSelection.deleteFailed", { count: failed }));
      } else {
        toast.success(
          t("manage.mapSelection.deleted", { count: succeeded.length }),
        );
      }
      clearAll();
    } finally {
      setDeleting(false);
    }
  };

  const busy = copying || deleting;

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur">
      <span className="text-sm font-medium whitespace-nowrap">
        {t("manage.mapSelection.selectedCount", { count })}
      </span>
      {!isViewer && (
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
            {t("manage.mapSelection.copy")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            {t("manage.mapSelection.delete")}
          </Button>
        </>
      )}
      <Button size="sm" variant="ghost" disabled={busy} onClick={clearAll}>
        <X className="h-4 w-4" />
        {t("manage.mapSelection.cancel")}
      </Button>
    </div>
  );
}
