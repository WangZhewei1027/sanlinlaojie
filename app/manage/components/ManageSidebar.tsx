import { Card } from "@/components/ui/card";
import { UploadAssetPanel } from "./upload/upload-asset-panel";
import { ClickedLocationCard } from "./ClickedLocationCard";
import { AssetManager } from "./AssetManager";
import type { LocationData, Asset } from "../types";

interface ManageSidebarProps {
  clickedLocation: LocationData | null;
  onUpload: () => void;
  onFocusAsset: (asset: Asset) => void;
}

export function ManageSidebar({
  clickedLocation,
  onUpload,
  onFocusAsset,
}: ManageSidebarProps) {
  return (
    <div className="h-full w-full overflow-hidden bg-background">
      {/* 侧边栏内容 */}
      <div className="h-full overflow-y-auto p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">资源管理</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理您的工作空间和资源
            </p>
          </div>

          {/* 点击位置卡片 */}
          <ClickedLocationCard clickedLocation={clickedLocation} />

          {/* 资产管理器 */}
          <AssetManager onFocusAsset={onFocusAsset} />
        </div>
      </div>
    </div>
  );
}
