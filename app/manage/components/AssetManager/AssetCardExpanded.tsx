import type { Asset } from "../../types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { AssetEditActions } from "./AssetEditActions";
import { AssetTextEditor } from "../AssetEditor/AssetTextEditor";
import { AssetImagePreview } from "../AssetEditor/AssetImagePreview";
import { AssetAudioPreview } from "../AssetEditor/AssetAudioPreview";
import { AssetLocationEditor } from "../AssetEditor/AssetLocationEditor";
import { AssetMetadata } from "../AssetEditor/AssetMetadata";

interface AssetCardExpandedProps {
  asset: Asset;
  fileName: string;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  showDeleteDialog: boolean;
  editedData: {
    text_content: string;
    longitude: string;
    latitude: string;
    height: string;
  };
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  onShowDeleteDialog?: () => void;
  onHideDeleteDialog: () => void;
  onTextChange: (text: string) => void;
  onLongitudeChange: (value: string) => void;
  onLatitudeChange: (value: string) => void;
  onHeightChange: (value: string) => void;
}

export function AssetCardExpanded({
  asset,
  fileName,
  isEditing,
  isSaving,
  isDeleting,
  showDeleteDialog,
  editedData,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onShowDeleteDialog,
  onHideDeleteDialog,
  onTextChange,
  onLongitudeChange,
  onLatitudeChange,
  onHeightChange,
}: AssetCardExpandedProps) {
  return (
    <>
      <Dialog open={showDeleteDialog} onOpenChange={onHideDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除这个资源吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onHideDeleteDialog}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-4 border-t bg-muted/20">
        <div className="space-y-4">
          {/* 编辑模式切换 */}
          <div className="flex justify-between gap-2">
            {onShowDeleteDialog && !isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={onShowDeleteDialog}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <AssetEditActions
                isEditing={isEditing}
                isSaving={isSaving}
                onEdit={onEdit}
                onSave={onSave}
                onCancel={onCancel}
              />
            </div>
          </div>

          {/* 文本内容编辑 */}
          {asset.file_type === "text" && (
            <AssetTextEditor
              textContent={asset.text_content}
              isEditing={isEditing}
              editedText={editedData.text_content}
              onTextChange={onTextChange}
            />
          )}

          {/* 图片预览 */}
          {asset.file_type === "image" && asset.file_url && (
            <AssetImagePreview fileUrl={asset.file_url} fileName={fileName} />
          )}

          {/* 音频预览 */}
          {asset.file_type === "audio" && asset.file_url && (
            <AssetAudioPreview
              key={asset.file_url}
              fileUrl={asset.file_url}
              fileName={fileName}
            />
          )}

          {/* 位置信息编辑 */}
          <AssetLocationEditor
            metadata={asset.metadata}
            isEditing={isEditing}
            editedLongitude={editedData.longitude}
            editedLatitude={editedData.latitude}
            editedHeight={editedData.height}
            onLongitudeChange={onLongitudeChange}
            onLatitudeChange={onLatitudeChange}
            onHeightChange={onHeightChange}
          />

          {/* 元数据和资产ID */}
          <AssetMetadata metadata={asset.metadata} assetId={asset.id} />
        </div>
      </div>
    </>
  );
}
