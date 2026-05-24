"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText } from "lucide-react";
import {
  isFieldEditable,
  getFieldLabel,
  getFieldPlaceholder,
} from "../../config";
import type { Asset } from "../../types";
import { AssetEditorDeleteDialog } from "./AssetEditorDeleteDialog";
import { AssetEditorActions } from "./AssetEditorActions";
import { AssetEditorModelConfigFields } from "./AssetEditorModelConfigFields";
import { AssetEditorTextStyleFields } from "./AssetEditorTextStyleFields";
import { useAssetEditor } from "./hooks/useAssetEditor";
import {
  AssetTextEditor,
  AssetNameEditor,
  AnchorSelector,
  AssetTagEditor,
  AssetLocationEditor,
  AssetMetadata,
} from "./fields";
import { AssetEditorPreviewSection } from "./previews";

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
  const {
    selectedAsset,
    assetConfig,
    selectedWorkspaceId,
    editedData,
    setEditedData,
    isEditing,
    setIsEditing,
    isSaving,
    isDeleting,
    showDeleteDialog,
    setShowDeleteDialog,
    checkinFile,
    setCheckinFile,
    imageFile,
    setImageFile,
    handleSave,
    handleCancel,
    handleDelete,
    handleClose,
  } = useAssetEditor({ onUpdateAsset, onDeleteAsset });

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

  const fileName =
    selectedAsset.file_type === "anchor" && selectedAsset.name
      ? selectedAsset.name
      : selectedAsset.file_url?.split("/").pop() || t("assetEditor.unnamed");

  return (
    <>
      <AssetEditorDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

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

        <div className="p-4 space-y-4">
          {/* 操作按钮 */}
          {!readOnly && (
            <AssetEditorActions
              isEditing={isEditing}
              isSaving={isSaving}
              canDelete={!!onDeleteAsset}
              onEditStart={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={handleCancel}
              onDeleteRequest={() => setShowDeleteDialog(true)}
            />
          )}

          {/* 名称 */}
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

          {/* 文本内容（anchor 类型的描述） */}
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

          {/* 文本内容（非 anchor 类型） */}
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

          {/* 预览区 */}
          <AssetEditorPreviewSection
            asset={selectedAsset}
            assetConfig={assetConfig}
            fileName={fileName}
            isEditing={isEditing}
            imageFile={imageFile}
            checkinFile={checkinFile}
            onImageFileSelect={setImageFile}
            onImageFileRemove={() => setImageFile(null)}
            onCheckinFileSelect={setCheckinFile}
            onCheckinFileRemove={() => setCheckinFile(null)}
          />

          {/* 锚点关联 */}
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

          {/* 标签 */}
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

          {/* 位置 */}
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

          {/* 模型配置（is_huge, scale_multiplier） */}
          {!readOnly && (
            <AssetEditorModelConfigFields
              asset={selectedAsset}
              isEditing={isEditing}
              isHuge={editedData.is_huge}
              scaleMultiplier={editedData.scale_multiplier}
              onIsHugeChange={(value) =>
                setEditedData({ ...editedData, is_huge: value })
              }
              onScaleMultiplierChange={(value) =>
                setEditedData({ ...editedData, scale_multiplier: value })
              }
            />
          )}

          {/* 文字样式（text_color, text_size） */}
          {!readOnly && (
            <AssetEditorTextStyleFields
              asset={selectedAsset}
              isEditing={isEditing}
              textColor={editedData.text_color}
              textSize={editedData.text_size}
              onTextColorChange={(value) =>
                setEditedData({ ...editedData, text_color: value })
              }
              onTextSizeChange={(value) =>
                setEditedData({ ...editedData, text_size: value })
              }
            />
          )}

          {/* 元数据 */}
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
