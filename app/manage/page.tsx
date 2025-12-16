"use client";

import { useState, useRef } from "react";
import { Responsive, useContainerWidth, Layout } from "react-grid-layout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAssets } from "./hooks/useAssets";
import { useViewerMessaging } from "./hooks/useViewerMessaging";
import { ViewerFrame } from "./components/ViewerFrame";
import { ManageSidebar } from "./components/ManageSidebar";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function ManagePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  // 使用自定义 hooks
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    loading,
  } = useWorkspace();

  const {
    assets,
    refetch: refetchAssets,
    loading: assetsLoading,
    updateAsset,
  } = useAssets(selectedWorkspaceId);

  const { clickedLocation, focusAsset } = useViewerMessaging({
    assets,
    iframeRef,
  });

  const handleUpload = async () => {
    console.log("上传成功");
    await refetchAssets();
  };

  // 网格布局配置
  const [layouts, setLayouts] = useState<Partial<Record<string, Layout>>>({
    lg: [
      { i: "viewer", x: 0, y: 0, w: 8, h: 12, minW: 4, minH: 12 },
      { i: "sidebar", x: 8, y: 0, w: 4, h: 12, minW: 3, minH: 12 },
    ],
  });

  const handleLayoutChange = (
    layout: Layout,
    allLayouts: Partial<Record<string, Layout>>
  ) => {
    // 自动调整布局，使两个组件总是占满整行
    const adjustedLayouts: Partial<Record<string, Layout>> = {};

    Object.keys(allLayouts).forEach((breakpoint) => {
      const currentLayout = allLayouts[breakpoint];
      if (currentLayout) {
        const cols =
          breakpoint === "lg"
            ? 12
            : breakpoint === "md"
            ? 10
            : breakpoint === "sm"
            ? 6
            : breakpoint === "xs"
            ? 4
            : 2;

        const viewerItem = currentLayout.find((item) => item.i === "viewer");
        const sidebarItem = currentLayout.find((item) => item.i === "sidebar");

        if (viewerItem && sidebarItem) {
          // 确保两个组件在同一行
          viewerItem.y = 0;
          sidebarItem.y = 0;

          // 调整sidebar位置和宽度以占满剩余空间
          sidebarItem.x = viewerItem.w;
          sidebarItem.w = cols - viewerItem.w;

          adjustedLayouts[breakpoint] = [viewerItem, sidebarItem];
        }
      }
    });

    setLayouts(adjustedLayouts);
  };

  return (
    <div
      ref={containerRef}
      className="h-screen w-full overflow-hidden bg-background"
    >
      {mounted && (
        <Responsive
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          width={width}
          resizeConfig={{
            enabled: true,
            handles: ["e", "w"],
          }}
          dragConfig={{
            enabled: false,
          }}
        >
          {/* Viewer 面板 */}
          <div
            key="viewer"
            className="bg-background border rounded-lg overflow-hidden"
          >
            <ViewerFrame iframeRef={iframeRef} />
          </div>

          {/* Sidebar 面板 */}
          <div
            key="sidebar"
            className="bg-background border rounded-lg overflow-hidden"
          >
            <ManageSidebar
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              selectedWorkspace={selectedWorkspace}
              onWorkspaceChange={setSelectedWorkspaceId}
              loading={loading}
              clickedLocation={clickedLocation}
              onUpload={handleUpload}
              assets={assets}
              assetsLoading={assetsLoading}
              onFocusAsset={focusAsset}
              onUpdateAsset={updateAsset}
            />
          </div>
        </Responsive>
      )}
    </div>
  );
}
