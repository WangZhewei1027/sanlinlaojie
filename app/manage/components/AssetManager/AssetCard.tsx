import { useManageStore } from "../../store";
import { useTranslation } from "react-i18next";
import type { Asset, Tag } from "../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Focus } from "lucide-react";
import { AssetThumbnail } from "./AssetThumbnail";

interface AssetCardProps {
  asset: Asset;
  tags: Tag[];
  onFocusAsset?: (asset: Asset) => void;
  compact?: boolean;
  selectMode?: boolean;
  isChecked?: boolean;
  onCheck?: (id: string) => void;
}

export function AssetCard({
  asset,
  tags,
  onFocusAsset,
  compact = false,
  selectMode = false,
  isChecked = false,
  onCheck,
}: AssetCardProps) {
  const { t } = useTranslation();
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId,
  );

  const isSelected = selectedAssetId === asset.id;

  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  // 优先显示 name, 否则显示文件名
  const getDisplayName = () => {
    if (asset.name) {
      return asset.name;
    }
    return asset.file_url?.split("/").pop() || t("assetManager.unnamed");
  };

  const fileName = getDisplayName();

  const handleClick = () => {
    if (selectMode) {
      onCheck?.(asset.id);
    } else {
      setSelectedAssetId(asset.id);
    }
  };

  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusAsset?.(asset);
  };

  return (
    <div
      className={`px-3 cursor-pointer transition-all ${
        compact ? "py-1" : "py-2"
      } ${
        isSelected
          ? "bg-primary/10 border-l-4 border-l-primary"
          : "hover:bg-muted/50 border-l-4 border-l-transparent"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        {/* 多选复选框 */}
        {selectMode && (
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => onCheck?.(asset.id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          />
        )}
        {/* 缩略图（仅详细视图且非多选模式） */}
        {!compact && !selectMode && (
          <div className="flex-shrink-0">
            <AssetThumbnail
              fileType={asset.file_type}
              fileUrl={asset.file_url}
              textContent={asset.text_content}
              fileName={fileName}
            />
          </div>
        )}

        {/* 基本信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {asset.file_type}
            </Badge>
            {hasLocation && (
              <MapPin className="h-3 w-3 text-muted-foreground" />
            )}
            {compact && (
              <p className="text-sm font-medium truncate leading-tight flex-1">
                {fileName}
              </p>
            )}
          </div>
          {!compact && (
            <>
              <p className="text-sm font-medium truncate leading-tight">
                {fileName}
              </p>
              {asset.file_type === "audio" && asset.metadata?.duration && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                  {t("assetManager.duration")}{" "}
                  {Math.floor(asset.metadata.duration / 60)}:
                  {String(Math.floor(asset.metadata.duration % 60)).padStart(
                    2,
                    "0",
                  )}
                </p>
              )}
              {asset.file_type === "text" && asset.text_content && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
                  {asset.text_content}
                </p>
              )}
              {asset.file_type === "anchor" && asset.text_content && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">
                  {asset.text_content}
                </p>
              )}
              {/* 显示标签 */}
              {asset.tag_ids && asset.tag_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {asset.tag_ids.map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge
                        key={tagId}
                        style={{ backgroundColor: tag.color }}
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* 操作按钮 */}
        {onFocusAsset && hasLocation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={handleFocus}
            title={t("assetManager.focusOnMap")}
          >
            <Focus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
