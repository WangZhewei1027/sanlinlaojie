import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, File, Focus } from "lucide-react";
import type { Asset } from "../../types";

interface AssetCardProps {
  asset: Asset;
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetCard({ asset, onFocusAsset }: AssetCardProps) {
  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors">
      <div className="space-y-3">
        {/* 基本信息 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Badge variant="secondary" className="text-xs">
                {asset.file_type}
              </Badge>
            </div>
            {asset.file_url && (
              <p className="text-sm text-muted-foreground truncate">
                {asset.file_url.split("/").pop()}
              </p>
            )}
          </div>
          {onFocusAsset && hasLocation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFocusAsset(asset)}
              className="flex-shrink-0"
            >
              <Focus className="h-4 w-4 mr-1" />
              定位
            </Button>
          )}
        </div>

        {/* 位置信息 */}
        {hasLocation && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground">
                经度: {asset.metadata.longitude?.toFixed(6) ?? "N/A"}
              </p>
              <p className="text-muted-foreground">
                纬度: {asset.metadata.latitude?.toFixed(6) ?? "N/A"}
              </p>
              {asset.metadata.height !== undefined && (
                <p className="text-muted-foreground">
                  高度: {asset.metadata.height.toFixed(2)}m
                </p>
              )}
              {asset.metadata.gps_source && (
                <p className="text-xs text-muted-foreground/75 mt-1">
                  来源: {asset.metadata.gps_source}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 其他元数据 */}
        {asset.metadata && Object.keys(asset.metadata).length > 0 && (
          <div className="text-xs">
            <details className="cursor-pointer">
              <summary className="text-muted-foreground hover:text-foreground transition-colors">
                查看完整元数据
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded-md overflow-x-auto text-xs">
                {JSON.stringify(asset.metadata, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* 资产 ID */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground/75 font-mono truncate">
            ID: {asset.id}
          </p>
        </div>
      </div>
    </div>
  );
}
