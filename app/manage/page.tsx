"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useAssets } from "./hooks/useAssets";
import { useViewerMessaging } from "./hooks/useViewerMessaging";
import { ViewerFrame } from "./components/ViewerFrame";
import { ManageSidebar } from "./components/ManageSidebar";
import { MANAGE_CONFIG } from "./config";

export default function ManagePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 使用自定义 hooks
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    loading,
  } = useWorkspaces();

  const {
    assets,
    refetch: refetchAssets,
    loading: assetsLoading,
  } = useAssets(selectedWorkspaceId);

  const { clickedLocation, focusAsset } = useViewerMessaging({
    assets,
    iframeRef,
  });

  const handleUpload = async () => {
    console.log("上传成功");
    await refetchAssets();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* 左侧 iframe 容器 */}
      <ViewerFrame iframeRef={iframeRef} sidebarOpen={sidebarOpen} />

      {/* 右侧侧边栏 */}
      <ManageSidebar
        sidebarOpen={sidebarOpen}
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
      />

      {/* 切换按钮 */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-1/2 -translate-y-1/2 z-50 rounded-lg shadow-lg transition-all duration-300 ease-in-out"
        style={{
          right: sidebarOpen ? `${MANAGE_CONFIG.SIDEBAR_WIDTH + 8}px` : "8px",
        }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
