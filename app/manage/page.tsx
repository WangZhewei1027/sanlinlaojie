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
      // 让 12 行恰好填满可视高度：扣除上下 containerPadding(12*2) 与 11 个行间距(12*11)
      const ROWS = 12;
      const verticalGutter = 12 * 2 + 12 * (ROWS - 1);
      const calculatedRowHeight = Math.max(
        32,
        Math.floor((containerHeight - verticalGutter) / ROWS)
      );
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
  // lg / md：三栏并排；sm 及以下：Viewer 置顶，其余面板依次纵向堆叠，方便移动端滚动浏览
  const layouts: Partial<Record<string, Layout>> = {
    lg: [
      { i: "assetManager", x: 0, y: 0, w: 3, h: 12, minW: 2, minH: 6 },
      { i: "viewer", x: 3, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
      { i: "sidebar", x: 9, y: 0, w: 3, h: 12, minW: 2, minH: 6 },
    ],
    md: [
      { i: "assetManager", x: 0, y: 0, w: 2, h: 12, minW: 2, minH: 6 },
      { i: "viewer", x: 2, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
      { i: "sidebar", x: 8, y: 0, w: 2, h: 12, minW: 2, minH: 6 },
    ],
    sm: [
      { i: "viewer", x: 0, y: 0, w: 6, h: 12, minW: 3, minH: 6 },
      { i: "assetManager", x: 0, y: 12, w: 3, h: 10, minW: 2, minH: 6 },
      { i: "sidebar", x: 3, y: 12, w: 3, h: 10, minW: 2, minH: 6 },
    ],
    xs: [
      { i: "viewer", x: 0, y: 0, w: 4, h: 11, minW: 2, minH: 6 },
      { i: "assetManager", x: 0, y: 11, w: 4, h: 9, minW: 2, minH: 6 },
      { i: "sidebar", x: 0, y: 20, w: 4, h: 9, minW: 2, minH: 6 },
    ],
    xxs: [
      { i: "viewer", x: 0, y: 0, w: 2, h: 11, minW: 1, minH: 6 },
      { i: "assetManager", x: 0, y: 11, w: 2, h: 9, minW: 1, minH: 6 },
      { i: "sidebar", x: 0, y: 20, w: 2, h: 9, minW: 1, minH: 6 },
    ],
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden bg-background"
    >
      {mounted && (
        <Responsive
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={rowHeight}
          width={width}
          margin={[12, 12]}
          containerPadding={[12, 12]}
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
