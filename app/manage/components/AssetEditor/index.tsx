"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Eye } from "lucide-react";
import { getPreviewType } from "../../config";
import type { Asset } from "../../types";
import { AssetEditorDeleteDialog } from "./AssetEditorDeleteDialog";
import { AssetEditorActions } from "./AssetEditorActions";
import { FieldSection } from "./FieldSection";
import { useAssetEditor } from "./hooks/useAssetEditor";
import { AssetEditorPreviewSection } from "./previews";
import {
  AssetEditorBasicsSection,
  AssetEditorPlacementSection,
  AssetEditorAppearanceSection,
  AssetEditorAdvancedSection,
} from "./sections";

interface AssetEditorProps {
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
  /** When true, hides all editing controls and only renders the asset preview */
  readOnly?: boolean;
}

const PREVIEWABLE_TYPES = ["image", "audio", "video", "link", "model"];

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

  const previewType = getPreviewType(selectedAsset.file_type);
  const hasPreview =
    selectedAsset.file_type === "shop" ||
    (PREVIEWABLE_TYPES.includes(previewType) && !!selectedAsset.file_url);

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

        <div className="p-4 space-y-3">
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

          {/* 基本信息：名称、描述、标签 */}
          {!readOnly && (
            <AssetEditorBasicsSection
              asset={selectedAsset}
              assetConfig={assetConfig}
              isEditing={isEditing}
              editedData={editedData}
              setEditedData={setEditedData}
              selectedWorkspaceId={selectedWorkspaceId}
            />
          )}

          {/* 预览 */}
          {hasPreview && (
            <FieldSection title={t("assetEditor.sections.preview")} icon={Eye}>
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
            </FieldSection>
          )}

          {/* 位置与锚点 */}
          {!readOnly && (
            <AssetEditorPlacementSection
              asset={selectedAsset}
              assetConfig={assetConfig}
              isEditing={isEditing}
              editedData={editedData}
              setEditedData={setEditedData}
              selectedWorkspaceId={selectedWorkspaceId}
            />
          )}

          {/* 外观样式 */}
          {!readOnly && (
            <AssetEditorAppearanceSection
              asset={selectedAsset}
              isEditing={isEditing}
              editedData={editedData}
              setEditedData={setEditedData}
            />
          )}

          {/* 高级信息：元数据、ID */}
          {!readOnly && <AssetEditorAdvancedSection asset={selectedAsset} />}
        </div>
      </Card>
    </>
  );
}
