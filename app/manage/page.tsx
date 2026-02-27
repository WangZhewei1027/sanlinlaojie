"use client";

import { useRef, useEffect, useState } from "react";
import { Responsive, useContainerWidth, Layout } from "react-grid-layout";
import { useViewerMessaging } from "./hooks/useViewerMessaging";
import { useManageStore } from "./store";
import { ViewerFrame } from "./components/ViewerFrame";
import { ManageSidebar } from "./components/ManageSidebar";
import { AssetManager, useAssetAPI } from "./components/AssetManager";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function ManagePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { width, containerRef, mounted } = useContainerWidth();
  const { handleUpdateAsset, handleDeleteAsset } = useAssetAPI();
  const [rowHeight, setRowHeight] = useState(50);

  // 动态计算 rowHeight
  useEffect(() => {
    if (!containerRef.current || !mounted) return;

    const updateRowHeight = () => {
      const containerHeight = containerRef.current?.clientHeight || 0;
      // 容器高度除以行数（12行），再减去一些 margin/padding
      const calculatedRowHeight = Math.floor((containerHeight - 130) / 12);
      setRowHeight(calculatedRowHeight);
    };

    updateRowHeight();

    const resizeObserver = new ResizeObserver(updateRowHeight);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, mounted]);

  // 直接从 zustand store 读取数据（WorkspaceProvider 负责同步）
  const filteredAssets = useManageStore((state) => state.filteredAssets);

  const { focusAsset } = useViewerMessaging({
    assets: filteredAssets,
    iframeRef,
  });

  // 网格布局配置
  const layouts: Partial<Record<string, Layout>> = {
    lg: [
      { i: "assetManager", x: 0, y: 0, w: 3, h: 12, minW: 2, minH: 12 },
      { i: "viewer", x: 3, y: 0, w: 6, h: 12, minW: 4, minH: 12 },
      { i: "sidebar", x: 9, y: 0, w: 3, h: 12, minW: 2, minH: 12 },
    ],
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-4rem)] bg-background"
    >
      {mounted && (
        <Responsive
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={rowHeight}
          width={width}
          resizeConfig={{
            enabled: false,
            // handles: ["e", "w"],
          }}
          dragConfig={{
            enabled: false,
          }}
        >
          {/* 资产管理器 */}
          <div key="assetManager">
            <AssetManager onFocusAsset={focusAsset} />
          </div>

          {/* Viewer 面板 */}
          <div
            key="viewer"
            className="bg-background border rounded-lg overflow-hidden"
          >
            <ViewerFrame iframeRef={iframeRef} />
          </div>

          {/* Sidebar 面板 */}
          <div key="sidebar" className="">
            <ManageSidebar
              onUpload={() => console.log("上传成功")}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
            />
          </div>
        </Responsive>
      )}
    </div>
  );
}
