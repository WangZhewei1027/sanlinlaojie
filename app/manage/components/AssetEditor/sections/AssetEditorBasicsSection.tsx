"use client";

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import {
  isFieldEditable,
  getFieldLabel,
  getFieldPlaceholder,
  type AssetTypeConfig,
} from "../../../config";
import type { Asset } from "../../../types";
import type { AssetEditedData } from "../hooks/useAssetEditor";
import { FieldSection } from "../FieldSection";
import { AssetNameEditor, AssetTextEditor, AssetTagEditor } from "../fields";

interface AssetEditorBasicsSectionProps {
  asset: Asset;
  assetConfig: AssetTypeConfig | null;
  isEditing: boolean;
  editedData: AssetEditedData;
  setEditedData: React.Dispatch<React.SetStateAction<AssetEditedData>>;
  selectedWorkspaceId: string | null;
}

/**
 * 基本信息分组：名称、描述/文本内容、标签。
 */
export function AssetEditorBasicsSection({
  asset,
  assetConfig,
  isEditing,
  editedData,
  setEditedData,
  selectedWorkspaceId,
}: AssetEditorBasicsSectionProps) {
  const { t } = useTranslation();

  const isAnchorLike = assetConfig?.previewType === "anchor";
  const showName = isFieldEditable(asset.file_type, "name");
  const showText = isFieldEditable(asset.file_type, "text_content");
  const showTags =
    isFieldEditable(asset.file_type, "tag_ids") && !!selectedWorkspaceId;

  if (!showName && !showText && !showTags) return null;

  return (
    <FieldSection
      title={t("assetEditor.sections.basics")}
      hint={t("assetEditor.sections.basicsHint")}
      icon={FileText}
    >
      {showName && (
        <AssetNameEditor
          name={asset.name}
          isEditing={isEditing}
          editedName={editedData.name}
          onNameChange={(name) => setEditedData((prev) => ({ ...prev, name }))}
          label={t(
            getFieldLabel(asset.file_type, "name", "assetEditor.fields.name"),
          )}
          placeholder={t(
            getFieldPlaceholder(
              asset.file_type,
              "name",
              "assetEditor.fields.namePlaceholder",
            ),
          )}
        />
      )}

      {showText && (
        <AssetTextEditor
          textContent={asset.text_content}
          isEditing={isEditing}
          editedText={editedData.text_content}
          onTextChange={(text) =>
            setEditedData((prev) => ({ ...prev, text_content: text }))
          }
          label={t(
            getFieldLabel(
              asset.file_type,
              "text_content",
              isAnchorLike
                ? "assetEditor.fields.description"
                : "assetEditor.fields.textContent",
            ),
          )}
          placeholder={t(
            getFieldPlaceholder(
              asset.file_type,
              "text_content",
              isAnchorLike
                ? "assetEditor.fields.descriptionPlaceholder"
                : "assetEditor.fields.textContentPlaceholder",
            ),
          )}
          emptyLabel={
            isAnchorLike
              ? "assetEditor.fields.noDescription"
              : "assetEditor.fields.noContent"
          }
        />
      )}

      {showTags && selectedWorkspaceId && (
        <AssetTagEditor
          tagIds={isEditing ? editedData.tag_ids : asset.tag_ids}
          workspaceId={selectedWorkspaceId}
          isEditing={isEditing}
          onTagIdsChange={(tagIds) =>
            setEditedData((prev) => ({ ...prev, tag_ids: tagIds }))
          }
        />
      )}
    </FieldSection>
  );
}
