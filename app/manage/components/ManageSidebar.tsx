import { UploadAssetPanel } from "./upload/upload-asset-panel";
import { ClickedLocationCard } from "./ClickedLocationCard";
import { AssetEditor } from "./AssetEditor";
import { useManageStore } from "../store";
import type { Asset } from "../types";

interface ManageSidebarProps {
  onUpload: () => void;
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function ManageSidebar({
  onUpload,
  onUpdateAsset,
  onDeleteAsset,
}: ManageSidebarProps) {
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const orgRole = selectedOrganization?.role ?? null;
  const isViewer = orgRole === "viewer";

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      {/* 侧边栏内容 */}
      <div className="h-full overflow-y-auto">
        <div className="space-y-4">
          {/* 点击位置卡片 */}
          <ClickedLocationCard />

          {/* 上传资产面板 - viewer 角色不可见 */}
          {!isViewer && <UploadAssetPanel onUpload={onUpload} />}

          {/* 资产编辑器 */}
          <AssetEditor
            onUpdateAsset={isViewer ? undefined : onUpdateAsset}
            onDeleteAsset={isViewer ? undefined : onDeleteAsset}
            readOnly={isViewer}
          />
        </div>
      </div>
    </div>
  );
}
