"use client";

import { useRef, type ReactNode } from "react";
import { useViewerMessaging } from "../hooks/useViewerMessaging";
import { useManageStore } from "../store";
import { ViewerFrame } from "./ViewerFrame";
import { ManageSidebar } from "./ManageSidebar";
import { MapSelectionBar } from "./MapSelectionBar";
import { AssetManager, useAssetAPI } from "./AssetManager";
import { ManageGridLayout } from "./placements/ManageGridLayout";

/**
 * The pre-v2 asset map, unchanged apart from the read-only switch. It reads
 * the persisted workspace selection (legacy teams only).
 */
export function LegacyManageView({ readOnly, notice, fill }: { readOnly: boolean; notice?: ReactNode; fill?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { handleUpdateAsset, handleDeleteAsset } = useAssetAPI();

  // 直接从 zustand store 读取数据（WorkspaceProvider 负责同步）
  const filteredAssets = useManageStore((state) => state.filteredAssets);

  const { focusAsset, clearViewerSelection } = useViewerMessaging({
    assets: filteredAssets,
    iframeRef,
  });

  return (
    <ManageGridLayout
      fill={fill}
      list={<AssetManager onFocusAsset={focusAsset} />}
      viewer={
        <>
          <MapSelectionBar clearViewerSelection={clearViewerSelection} readOnly={readOnly} />
          {notice && <div className="absolute bottom-2 left-2 right-2 z-20 rounded-md bg-background shadow-sm sm:right-auto sm:max-w-md">{notice}</div>}
          <ViewerFrame iframeRef={iframeRef} />
        </>
      }
      sidebar={
        <ManageSidebar
          onUpload={() => console.log("上传成功")}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          readOnly={readOnly}
        />
      }
    />
  );
}
