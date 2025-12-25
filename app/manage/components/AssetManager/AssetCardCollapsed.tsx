import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown, ChevronUp, Focus } from "lucide-react";
import type { Asset } from "../../types";
import { AssetThumbnail } from "./AssetThumbnail";

interface AssetCardCollapsedProps {
  asset: Asset;
  isExpanded: boolean;
  hasLocation: boolean;
  fileName: string;
  onToggle: () => void;
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetCardCollapsed({
  asset,
  isExpanded,
  hasLocation,
  fileName,
  onToggle,
  onFocusAsset,
}: AssetCardCollapsedProps) {
  return (
    <div
      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        {/* 缩略图 */}
        <AssetThumbnail
          fileType={asset.file_type}
          fileUrl={asset.file_url}
          textContent={asset.text_content}
          fileName={fileName}
        />

        {/* 基本信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {asset.file_type}
            </Badge>
            {hasLocation && (
              <MapPin className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium truncate">{fileName}</p>
          {asset.file_type === "text" && asset.text_content && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {asset.text_content}
            </p>
          )}
          {asset.file_type === "anchor" && asset.text_content && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {asset.text_content}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onFocusAsset && hasLocation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onFocusAsset(asset);
              }}
            >
              <Focus className="h-4 w-4" />
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}
