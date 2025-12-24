import { useManageStore } from "../../store";
import type { Asset } from "../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Focus } from "lucide-react";
import { AssetThumbnail } from "./AssetThumbnail";

interface AssetCardProps {
  asset: Asset;
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetCard({ asset, onFocusAsset }: AssetCardProps) {
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId
  );

  const isSelected = selectedAssetId === asset.id;

  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  const fileName = asset.file_url?.split("/").pop() || "未命名文件";

  const handleClick = () => {
    setSelectedAssetId(asset.id);
  };

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusAsset?.(asset);
  };

  return (
    <div
      className={`px-3 py-2 cursor-pointer transition-all ${
        isSelected
          ? "bg-primary/10 border-l-4 border-l-primary"
          : "hover:bg-muted/50 border-l-4 border-l-transparent"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        {/* 缩略图 */}
        <div className="flex-shrink-0">
          <AssetThumbnail
            fileType={asset.file_type}
            fileUrl={asset.file_url}
            textContent={asset.text_content}
            fileName={fileName}
          />
        </div>

        {/* 基本信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {asset.file_type}
            </Badge>
            {hasLocation && (
              <MapPin className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium truncate leading-tight">
            {fileName}
          </p>
          {asset.file_type === "text" && asset.text_content && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
              {asset.text_content}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        {onFocusAsset && hasLocation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={handleFocus}
            title="定位到地图"
          >
            <Focus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
