"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { AssetLinkPreview } from "./AssetLinkPreview";
import { AssetLocationEditor } from "./AssetLocationEditor";
import { AssetMetadata } from "./AssetMetadata";
import { AssetNameEditor } from "./AssetNameEditor";
import { AnchorSelector } from "./AnchorSelector";
import { AssetTagEditor } from "./AssetTagEditor";
import { AssetCheckinPhotoEditor } from "./AssetCheckinPhotoEditor";
import { AssetModelPreview } from "./AssetModelPreview";
import { FileUploadService } from "@/lib/upload/service";
import {
  getAssetConfig,
  isFieldEditable,
  getFieldLabel,
  getFieldPlaceholder,
} from "../../config";

interface AssetEditorProps {
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
  /** When true, hides all editing controls and only renders the asset preview */
  readOnly?: boolean;
}

export function AssetEditor({
  onUpdateAsset,
  onDeleteAsset,
  readOnly = false,
}: AssetEditorProps) {
  const { t } = useTranslation();
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId,
  );
  const assets = useManageStore((state) => state.assets);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [checkinFile, setCheckinFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editedData, setEditedData] = useState({
    name: "",
    text_content: "",
    anchor_id: null as string | null,
    tag_ids: [] as string[],
    longitude: "",
    latitude: "",
    height: "",
    is_huge: false,
  });

  // 获取选中的资产
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  // 获取当前资产类型的配置
  const assetConfig = useMemo(() => {
    return selectedAsset ? getAssetConfig(selectedAsset.file_type) : null;
  }, [selectedAsset]);

  // 当选中的资产变化时，重置编辑状态
  useEffect(() => {
    if (selectedAsset) {
      setEditedData({
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        tag_ids: selectedAsset.tag_ids || [],
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
        is_huge: selectedAsset.is_huge ?? false,
      });
      setCheckinFile(null);
      setImageFile(null);
      setIsEditing(false);
    }
  }, [selectedAsset]);

  const handleSave = useCallback(async () => {
    if (!selectedAsset || !onUpdateAsset) return;

    setIsSaving(true);
    try {
      const updates: Partial<Asset> = {};

      // 根据配置决定保存哪些字段
      if (isFieldEditable(selectedAsset.file_type, "location")) {
        updates.metadata = {
          longitude: editedData.longitude
            ? parseFloat(editedData.longitude)
            : undefined,
          latitude: editedData.latitude
            ? parseFloat(editedData.latitude)
            : undefined,
          height: editedData.height ? parseFloat(editedData.height) : undefined,
        };
      }

      // 图片类型：如果选择了新图片，先上传再更新 file_url
      if (assetConfig?.previewType === "image" && imageFile) {
        const uploadService = new FileUploadService();
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const processed = await uploadService.processFile(imageFile);
          const newFileUrl = await uploadService.uploadToStorage(
            processed.file,
            user.id,
          );
          updates.file_url = newFileUrl;
        }
      }

      // shop 类型：如果选择了新的打卡凭证照片，先上传再将 URL 写入 metadata
      if (selectedAsset.file_type === "shop" && checkinFile) {
        const uploadService = new FileUploadService();
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const processed = await uploadService.processFile(checkinFile);
          const checkinUrl = await uploadService.uploadToStorage(
            processed.file,
            user.id,
          );
          updates.metadata = {
            ...updates.metadata,
            checkin_url: checkinUrl,
          };
        }
      }

      if (isFieldEditable(selectedAsset.file_type, "name")) {
        updates.name = editedData.name;
      }

      if (isFieldEditable(selectedAsset.file_type, "text_content")) {
        updates.text_content = editedData.text_content;
      }

      if (isFieldEditable(selectedAsset.file_type, "anchor_id")) {
        updates.anchor_id = editedData.anchor_id;
      }

      if (isFieldEditable(selectedAsset.file_type, "tag_ids")) {
        updates.tag_ids = editedData.tag_ids;
      }

      if (isFieldEditable(selectedAsset.file_type, "is_huge")) {
        updates.is_huge = editedData.is_huge;
      }

      await onUpdateAsset(selectedAsset.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error("保存失败:", error);
      alert(t("assetEditor.saveFailed"));
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset, editedData, onUpdateAsset]);

  const handleCancel = useCallback(() => {
    if (selectedAsset) {
      setEditedData({
        tag_ids: selectedAsset.tag_ids || [],
        name: selectedAsset.name || "",
        text_content: selectedAsset.text_content || "",
        anchor_id: selectedAsset.anchor_id || null,
        longitude: selectedAsset.metadata.longitude?.toString() || "",
        latitude: selectedAsset.metadata.latitude?.toString() || "",
        height: selectedAsset.metadata.height?.toString() || "",
        is_huge: selectedAsset.is_huge ?? false,
      });
      setCheckinFile(null);
      setImageFile(null);
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
      alert(t("assetEditor.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <p className="text-sm text-muted-foreground">
            {t("assetEditor.selectAsset")}
          </p>
        </div>
      </Card>
    );
  }

  // 获取显示名称
  const getDisplayName = () => {
    if (selectedAsset.file_type === "anchor" && selectedAsset.name) {
      return selectedAsset.name;
    }
    return selectedAsset.file_url?.split("/").pop() || t("assetEditor.unnamed");
  };

  const fileName = getDisplayName();

  return (
    <>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("assetEditor.deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("assetEditor.deleteWarning")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {t("assetEditor.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("common.delete")}
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
            <h3 className="font-semibold text-sm truncate">
              {t("assetEditor.title")}
            </h3>
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
          {/* 操作按钮 - viewer 只读时隐藏 */}
          {!readOnly && (
            <div className="flex justify-between gap-2">
              {onDeleteAsset && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("common.delete")}
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                {!isEditing ? (
                  <Button size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    {t("common.edit")}
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
                      {t("common.cancel")}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          {t("assetEditor.saving")}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          {t("common.save")}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 锁点名称编辑 - viewer 只读时隐藏 */}
          {!readOnly && isFieldEditable(selectedAsset.file_type, "name") && (
            <AssetNameEditor
              name={selectedAsset.name}
              isEditing={isEditing}
              editedName={editedData.name}
              onNameChange={(name) => setEditedData({ ...editedData, name })}
              label={t(
                getFieldLabel(
                  selectedAsset.file_type,
                  "name",
                  "assetEditor.fields.name",
                ),
              )}
              placeholder={t(
                getFieldPlaceholder(
                  selectedAsset.file_type,
                  "name",
                  "assetEditor.fields.namePlaceholder",
                ),
              )}
            />
          )}

          {/* 文本内容编辑 - 用于 anchor 类型的描述，viewer 只读时隐藏 */}
          {!readOnly &&
            isFieldEditable(selectedAsset.file_type, "text_content") &&
            assetConfig?.previewType === "anchor" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t(
                    getFieldLabel(
                      selectedAsset.file_type,
                      "text_content",
                      "assetEditor.fields.description",
                    ),
                  )}
                </label>
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
                    placeholder={t(
                      getFieldPlaceholder(
                        selectedAsset.file_type,
                        "text_content",
                        "assetEditor.fields.descriptionPlaceholder",
                      ),
                    )}
                  />
                ) : (
                  <p className="text-sm p-3 bg-background rounded-md">
                    {selectedAsset.text_content ||
                      t("assetEditor.fields.noDescription")}
                  </p>
                )}
              </div>
            )}

          {/* 文本内容编辑 - 用于 text 类型，viewer 只读时隐藏 */}
          {!readOnly &&
            isFieldEditable(selectedAsset.file_type, "text_content") &&
            assetConfig?.previewType !== "anchor" && (
              <AssetTextEditor
                textContent={selectedAsset.text_content}
                isEditing={isEditing}
                editedText={editedData.text_content}
                onTextChange={(text) =>
                  setEditedData({ ...editedData, text_content: text })
                }
                label={t(
                  getFieldLabel(
                    selectedAsset.file_type,
                    "text_content",
                    "assetEditor.fields.textContent",
                  ),
                )}
                placeholder={t(
                  getFieldPlaceholder(
                    selectedAsset.file_type,
                    "text_content",
                    "assetEditor.fields.textContentPlaceholder",
                  ),
                )}
              />
            )}

          {/* 图片预览 */}
          {assetConfig?.previewType === "image" && selectedAsset.file_url && (
            <AssetImagePreview
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
              isEditing={isEditing}
              newImageFile={imageFile}
              onFileSelect={setImageFile}
              onFileRemove={() => setImageFile(null)}
            />
          )}

          {/* shop 类型：打卡凭证照片 */}
          {selectedAsset.file_type === "shop" && (
            <AssetCheckinPhotoEditor
              checkinUrl={selectedAsset.metadata.checkin_url}
              checkinFile={checkinFile}
              isEditing={isEditing}
              onFileSelect={setCheckinFile}
              onFileRemove={() => setCheckinFile(null)}
            />
          )}

          {/* 音频预览 */}
          {assetConfig?.previewType === "audio" && selectedAsset.file_url && (
            <AssetAudioPreview
              key={selectedAsset.file_url}
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
            />
          )}

          {/* 链接预览 */}
          {assetConfig?.previewType === "link" && selectedAsset.file_url && (
            <AssetLinkPreview
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
            />
          )}

          {/* 3D 模型预览 */}
          {assetConfig?.previewType === "model" && selectedAsset.file_url && (
            <AssetModelPreview
              fileUrl={selectedAsset.file_url}
              fileName={fileName}
            />
          )}

          {/* 锚点关联 - viewer 只读时隐藏 */}
          {!readOnly &&
            isFieldEditable(selectedAsset.file_type, "anchor_id") &&
            selectedWorkspaceId && (
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

          {/* 标签编辑 - viewer 只读时隐藏 */}
          {!readOnly &&
            isFieldEditable(selectedAsset.file_type, "tag_ids") &&
            selectedWorkspaceId && (
              <AssetTagEditor
                tagIds={isEditing ? editedData.tag_ids : selectedAsset.tag_ids}
                workspaceId={selectedWorkspaceId}
                isEditing={isEditing}
                onTagIdsChange={(tagIds) =>
                  setEditedData({ ...editedData, tag_ids: tagIds })
                }
              />
            )}

          {/* 位置信息编辑 - viewer 只读时隐藏 */}
          {!readOnly &&
            isFieldEditable(selectedAsset.file_type, "location") && (
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
            )}

          {/* is_huge 字段 - 仅 model 类型可编辑，viewer 只读时隐藏 */}
          {!readOnly && isFieldEditable(selectedAsset.file_type, "is_huge") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_huge"
                checked={
                  isEditing
                    ? editedData.is_huge
                    : (selectedAsset.is_huge ?? false)
                }
                onChange={(e) =>
                  setEditedData({ ...editedData, is_huge: e.target.checked })
                }
                disabled={!isEditing}
                className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50"
              />
              <label
                htmlFor="is_huge"
                className="text-sm font-medium leading-none"
              >
                {t(
                  getFieldLabel(
                    selectedAsset.file_type,
                    "is_huge",
                    "assetEditor.fields.isHuge",
                  ),
                )}
              </label>
            </div>
          )}

          {/* 元数据和资产ID - viewer 只读时隐藏 */}
          {!readOnly && (
            <AssetMetadata
              metadata={selectedAsset.metadata}
              assetId={selectedAsset.id}
            />
          )}
        </div>
      </Card>
    </>
  );
}
