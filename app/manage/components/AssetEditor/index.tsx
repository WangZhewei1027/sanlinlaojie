"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2, Edit2, Save, X, FileText } from "lucide-react";
import { useManageStore } from "../../store";
import type { Asset } from "../../types";
import { AssetTextEditor } from "./AssetTextEditor";
import { AssetImagePreview } from "./AssetImagePreview";
import { AssetAudioPreview } from "./AssetAudioPreview";
import { AssetLocationEditor } from "./AssetLocationEditor";
import { AssetMetadata } from "./AssetMetadata";
import { AssetNameEditor } from "./AssetNameEditor";
import { AnchorSelector } from "./AnchorSelector";

interface AssetEditorProps {
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function AssetEditor({
  onUpdateAsset,
  onDeleteAsset,
}: AssetEditorProps) {
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId
  );
  const assets = useManageStore((state) => state.assets);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedData, setEditedData] = useState({
    name: "",
    text_content: "",
    anchor_id: null as string | null,
    longitude: "",
    latitude: "",
    height: "",
  });

  // 获取选中的资产
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  // 当选中的资产变化时，重置编辑状态
  useEffect(() => {
    if (selectedAsset) {
      setEditedData({
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
      });
      setIsEditing(false);
    }
  }, [selectedAsset]);

  const handleSave = useCallback(async () => {
    if (!selectedAsset || !onUpdateAsset) return;

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
          height: editedData.height ? parseFloat(editedData.height) : undefined,
        },
      };

      if (selectedAsset.file_type === "text") {
        updates.text_content = editedData.text_content;
      }

      if (selectedAsset.file_type === "anchor") {
        updates.name = editedData.name;
        updates.text_content = editedData.text_content;
      }

      // 对于非 anchor 类型，更新 anchor_id
      if (selectedAsset.file_type !== "anchor") {
        updates.anchor_id = editedData.anchor_id;
      }

      await onUpdateAsset(selectedAsset.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error("保存失败:", error);
      alert("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }, [selectedAsset, editedData, onUpdateAsset]);

  const handleCancel = useCallback(() => {
    if (selectedAsset) {
      setEditedData({
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
      });
    }
    setIsEditing(false);
  }, [selectedAsset]);

  const handleDelete = useCallback(async () => {
    if (!selectedAsset || !onDeleteAsset) return;

    setIsDeleting(true);
    try {
      await onDeleteAsset(selectedAsset.id);
      setShowDeleteDialog(false);
      setSelectedAssetId(null);
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败，请重试");
    } finally {
      setIsDeleting(false);
    }
  }, [selectedAsset, onDeleteAsset, setSelectedAssetId]);

  const handleClose = useCallback(() => {
    setSelectedAssetId(null);
    setIsEditing(false);
  }, [setSelectedAssetId]);

  if (!selectedAsset) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center space-y-2 py-8">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">选择一个资源进行编辑</p>
        </div>
      </Card>
    );
  }

  // 获取显示名称
  const getDisplayName = () => {
    if (selectedAsset.file_type === "anchor" && selectedAsset.name) {
      return selectedAsset.name;
    }
    return selectedAsset.file_url?.split("/").pop() || "未命名文件";
  };

  const fileName = getDisplayName();

  return (
    <>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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

      <Card className="overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/20">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">资源编辑器</h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {fileName}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="ml-2 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 编辑内容 */}
        <div className="p-4 space-y-4">
          {/* 操作按钮 */}
          <div className="flex justify-between gap-2">
            {onDeleteAsset && !isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              {!isEditing ? (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  编辑
                </Button>
              ) : (
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
              )}
            </div>
          </div>

          {/* 锁点名称编辑 */}
          {selectedAsset.file_type === "anchor" && (
            <AssetNameEditor
              name={selectedAsset.name}
              isEditing={isEditing}
              editedName={editedData.name}
              onNameChange={(name) => setEditedData({ ...editedData, name })}
            />
          )}

          {/* 锁点描述编辑 */}
          {selectedAsset.file_type === "anchor" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">锁点描述（可选）</label>
              {isEditing ? (
                <textarea
                  value={editedData.text_content}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      text_content: e.target.value,
                    })
                  }
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="输入锁点描述（可选）"
                />
              ) : (
                <p className="text-sm p-3 bg-background rounded-md">
                  {selectedAsset.text_content || "无描述"}
                </p>
              )}
            </div>
          )}

          {/* 文本内容编辑 */}
          {selectedAsset.file_type === "text" && (
            <AssetTextEditor
              textContent={selectedAsset.text_content}
              isEditing={isEditing}
              editedText={editedData.text_content}
              onTextChange={(text) =>
                setEditedData({ ...editedData, text_content: text })
              }
            />
          )}

          {/* 图片预览 */}
          {selectedAsset.file_type === "image" && selectedAsset.file_url && (
            <AssetImagePreview
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
            />
          )}

          {/* 音频预览 */}
          {selectedAsset.file_type === "audio" && selectedAsset.file_url && (
            <AssetAudioPreview
              key={selectedAsset.file_url}
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
            />
          )}

          {/* 锚点关联（非 anchor 类型显示） */}
          {selectedAsset.file_type !== "anchor" && selectedWorkspaceId && (
            <AnchorSelector
              currentAnchorId={
                isEditing ? editedData.anchor_id : selectedAsset.anchor_id
              }
              workspaceId={selectedWorkspaceId}
              isEditing={isEditing}
              onAnchorChange={(anchorId) =>
                setEditedData({ ...editedData, anchor_id: anchorId })
              }
            />
          )}

          {/* 位置信息编辑 */}
          <AssetLocationEditor
            metadata={selectedAsset.metadata}
            isEditing={isEditing}
            editedLongitude={editedData.longitude}
            editedLatitude={editedData.latitude}
            editedHeight={editedData.height}
            onLongitudeChange={(value) =>
              setEditedData((prev) => ({ ...prev, longitude: value }))
            }
            onLatitudeChange={(value) =>
              setEditedData((prev) => ({ ...prev, latitude: value }))
            }
            onHeightChange={(value) =>
              setEditedData((prev) => ({ ...prev, height: value }))
            }
          />

          {/* 元数据和资产ID */}
          <AssetMetadata
            metadata={selectedAsset.metadata}
            assetId={selectedAsset.id}
          />
        </div>
      </Card>
    </>
  );
}
