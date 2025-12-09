import { Card } from "@/components/ui/card";
import { UploadAssetPanel } from "./upload/upload-asset-panel";
import { WorkspaceSelect } from "./WorkspaceSelect";
import { ClickedLocationCard } from "./ClickedLocationCard";
import { AssetManager } from "./AssetManager";
import type { Workspace, LocationData, Asset } from "../types";
import { MANAGE_CONFIG } from "../config";

interface ManageSidebarProps {
  sidebarOpen: boolean;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: Workspace | undefined;
  onWorkspaceChange: (workspaceId: string) => void;
  loading: boolean;
  clickedLocation: LocationData | null;
  onUpload: () => void;
  assets: Asset[];
  assetsLoading: boolean;
  onFocusAsset: (asset: Asset) => void;
}

export function ManageSidebar({
  sidebarOpen,
  workspaces,
  selectedWorkspaceId,
  selectedWorkspace,
  onWorkspaceChange,
  loading,
  clickedLocation,
  onUpload,
  assets,
  assetsLoading,
  onFocusAsset,
}: ManageSidebarProps) {
  return (
    <div
      className="relative border-l transition-all duration-300 ease-in-out overflow-hidden bg-background"
      style={{
        width: sidebarOpen ? `${MANAGE_CONFIG.SIDEBAR_WIDTH}px` : "0px",
      }}
    >
      {/* 侧边栏内容 */}
      <div className="h-full overflow-y-auto p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">资源管理</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理您的工作空间和资源
            </p>
          </div>

          {/* Workspace 选择器 */}
          <WorkspaceSelect
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            selectedWorkspace={selectedWorkspace}
            onWorkspaceChange={onWorkspaceChange}
            loading={loading}
          />

          {/* 上传面板 */}
          {selectedWorkspaceId ? (
            <UploadAssetPanel
              workspaceId={selectedWorkspaceId}
              location={clickedLocation}
              onUpload={onUpload}
            />
          ) : (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                请先选择工作空间
              </p>
            </Card>
          )}

          {/* 点击位置卡片 */}
          <ClickedLocationCard clickedLocation={clickedLocation} />

          {/* 资产管理器 */}
          {selectedWorkspaceId && (
            <AssetManager
              assets={assets}
              loading={assetsLoading}
              onFocusAsset={onFocusAsset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
