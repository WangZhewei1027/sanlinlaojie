import { UploadAssetPanel } from "./upload/upload-asset-panel";
import { ClickedLocationCard } from "./ClickedLocationCard";
import { AssetEditor } from "./AssetEditor";
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
  return (
    <div className="h-full w-full overflow-hidden bg-background">
      {/* 侧边栏内容 */}
      <div className="h-full overflow-y-auto">
        <div className="space-y-4">
          {/* 点击位置卡片 */}
          <ClickedLocationCard />

          {/* 上传资产面板 */}
          <UploadAssetPanel onUpload={onUpload} />

          {/* 资产编辑器 */}
          <AssetEditor
            onUpdateAsset={onUpdateAsset}
            onDeleteAsset={onDeleteAsset}
          />
        </div>
      </div>
    </div>
  );
}
