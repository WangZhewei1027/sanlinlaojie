import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  File,
  Focus,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import type { Asset } from "../../types";

interface AssetCardProps {
  asset: Asset;
  onFocusAsset?: (asset: Asset) => void;
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
}

export function AssetCard({
  asset,
  onFocusAsset,
  onUpdateAsset,
}: AssetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState({
    text_content: asset.text_content || "",
    longitude: asset.metadata.longitude?.toString() || "",
    latitude: asset.metadata.latitude?.toString() || "",
    height: asset.metadata.height?.toString() || "",
  });

  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  const fileName = asset.file_url?.split("/").pop() || "未命名文件";

  const handleSave = async () => {
    if (onUpdateAsset) {
      setIsSaving(true);
      try {
        const updates: Partial<Asset> = {
          metadata: {
            longitude: editedData.longitude
              ? parseFloat(editedData.longitude)
              : undefined,
            latitude: editedData.latitude
              ? parseFloat(editedData.latitude)
              : undefined,
            height: editedData.height
              ? parseFloat(editedData.height)
              : undefined,
          },
        };

        if (asset.file_type === "text") {
          updates.text_content = editedData.text_content;
        }

        await onUpdateAsset(asset.id, updates);
        setIsEditing(false);
      } catch (error) {
        console.error("保存失败:", error);
        alert("保存失败，请重试");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedData({
      text_content: asset.text_content || "",
      longitude: asset.metadata.longitude?.toString() || "",
      latitude: asset.metadata.latitude?.toString() || "",
      height: asset.metadata.height?.toString() || "",
    });
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-all">
      {/* 折叠视图 */}
      <div
        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* 缩略图 */}
          <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {asset.file_type === "image" && asset.file_url ? (
              <img
                src={asset.file_url}
                alt={fileName}
                className="w-full h-full object-cover"
              />
            ) : asset.file_type === "text" && asset.text_content ? (
              <div className="w-full h-full flex items-center justify-center p-2 text-xs text-center text-muted-foreground line-clamp-3">
                {asset.text_content}
              </div>
            ) : (
              <File className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

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

      {/* 展开视图 */}
      {isExpanded && (
        <div className="p-4 border-t bg-muted/20">
          <div className="space-y-4">
            {/* 编辑模式切换 */}
            <div className="flex justify-end gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        保存
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  编辑
                </Button>
              )}
            </div>

            {/* 文本内容编辑 */}
            {asset.file_type === "text" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">文本内容</label>
                {isEditing ? (
                  <Textarea
                    value={editedData.text_content}
                    onChange={(e) =>
                      setEditedData({
                        ...editedData,
                        text_content: e.target.value,
                      })
                    }
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm p-3 bg-background rounded-md">
                    {asset.text_content || "无内容"}
                  </p>
                )}
              </div>
            )}

            {/* 图片预览 */}
            {asset.file_type === "image" && asset.file_url && (
              <div className="space-y-2">
                <label className="text-sm font-medium">图片预览</label>
                <div className="rounded-md overflow-hidden border">
                  <img
                    src={asset.file_url}
                    alt={fileName}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {asset.file_url}
                </p>
              </div>
            )}

            {/* 位置信息编辑 */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                位置信息
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">经度</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.000001"
                      value={editedData.longitude}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          longitude: e.target.value,
                        })
                      }
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm p-2 bg-background rounded-md">
                      {asset.metadata.longitude?.toFixed(6) ?? "N/A"}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">纬度</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.000001"
                      value={editedData.latitude}
                      onChange={(e) =>
                        setEditedData({
                          ...editedData,
                          latitude: e.target.value,
                        })
                      }
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm p-2 bg-background rounded-md">
                      {asset.metadata.latitude?.toFixed(6) ?? "N/A"}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    高度(m)
                  </label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editedData.height}
                      onChange={(e) =>
                        setEditedData({ ...editedData, height: e.target.value })
                      }
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm p-2 bg-background rounded-md">
                      {asset.metadata.height?.toFixed(2) ?? "N/A"}
                    </p>
                  )}
                </div>
              </div>
              {asset.metadata.gps_source && (
                <p className="text-xs text-muted-foreground">
                  来源: {asset.metadata.gps_source}
                </p>
              )}
            </div>

            {/* 元数据 */}
            <div className="space-y-2">
              <details className="cursor-pointer">
                <summary className="text-sm font-medium hover:text-foreground transition-colors">
                  完整元数据
                </summary>
                <pre className="mt-2 p-3 bg-background rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(asset.metadata, null, 2)}
                </pre>
              </details>
            </div>

            {/* 资产 ID */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground font-mono truncate">
                ID: {asset.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
