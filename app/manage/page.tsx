"use client";

import { useRef, useEffect } from "react";
import { Responsive, useContainerWidth, Layout } from "react-grid-layout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useViewerMessaging } from "./hooks/useViewerMessaging";
import { useManageStore } from "./store";
import { ViewerFrame } from "./components/ViewerFrame";
import { ManageSidebar } from "./components/ManageSidebar";
import { AssetManager } from "./components/AssetManager";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function ManagePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  // 使用原有的 hooks 获取数据，但将状态存入 zustand
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId: _setSelectedWorkspaceId,
    loading,
  } = useWorkspace();

  // 同步数据到 zustand store
  const setStoreWorkspaces = useManageStore((state) => state.setWorkspaces);
  const setStoreSelectedWorkspaceId = useManageStore(
    (state) => state.setSelectedWorkspaceId
  );
  const setStoreSelectedWorkspace = useManageStore(
    (state) => state.setSelectedWorkspace
  );
  const setStoreWorkspaceLoading = useManageStore(
    (state) => state.setWorkspaceLoading
  );
  const assets = useManageStore((state) => state.assets);

  // 同步 workspace 数据
  useEffect(() => {
    setStoreWorkspaces(workspaces);
  }, [workspaces, setStoreWorkspaces]);

  useEffect(() => {
    setStoreSelectedWorkspaceId(selectedWorkspaceId);
  }, [selectedWorkspaceId, setStoreSelectedWorkspaceId]);

  useEffect(() => {
    setStoreSelectedWorkspace(selectedWorkspace || null);
  }, [selectedWorkspace, setStoreSelectedWorkspace]);

  useEffect(() => {
    setStoreWorkspaceLoading(loading);
  }, [loading, setStoreWorkspaceLoading]);

  const { focusAsset } = useViewerMessaging({
    assets,
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
      className="w-full bg-background"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {mounted && (
        <Responsive
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
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
            <ManageSidebar onUpload={() => console.log("上传成功")} />
          </div>
        </Responsive>
      )}
    </div>
  );
}
