import { UploadAssetPanel } from "./upload/upload-asset-panel";
import { ClickedLocationCard } from "./ClickedLocationCard";

interface ManageSidebarProps {
  onUpload: () => void;
}

export function ManageSidebar({ onUpload }: ManageSidebarProps) {
  return (
    <div className="h-full w-full overflow-hidden bg-background">
      {/* 侧边栏内容 */}
      <div className="h-full overflow-y-auto">
        <div className="space-y-4">
          {/* 点击位置卡片 */}
          <ClickedLocationCard />

          {/* 上传资产面板 */}
          <UploadAssetPanel onUpload={onUpload} />
        </div>
      </div>
    </div>
  );
}
