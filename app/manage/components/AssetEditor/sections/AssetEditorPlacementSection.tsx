"use client";

import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { isFieldEditable, type AssetTypeConfig } from "../../../config";
import type { Asset } from "../../../types";
import type { AssetEditedData } from "../hooks/useAssetEditor";
import { FieldSection } from "../FieldSection";
import { FieldLabel } from "../FieldLabel";
import { AnchorSelector, AssetLocationEditor } from "../fields";
import { Text } from "@/components/ui/typography";

interface AssetEditorPlacementSectionProps {
  asset: Asset;
  assetConfig: AssetTypeConfig | null;
  isEditing: boolean;
  editedData: AssetEditedData;
  setEditedData: React.Dispatch<React.SetStateAction<AssetEditedData>>;
  selectedWorkspaceId: string | null;
}

/**
 * 位置与锚点分组：关联锚点、地理位置（经纬度 / 高度）。
 */
export function AssetEditorPlacementSection({
  asset,
  isEditing,
  editedData,
  setEditedData,
  selectedWorkspaceId,
}: AssetEditorPlacementSectionProps) {
  const { t } = useTranslation();

  const canShowAnchor = isFieldEditable(asset.file_type, "anchor_id");
  const showLocation = isFieldEditable(asset.file_type, "location");

  if (!canShowAnchor && !showLocation) return null;

  return (
    <FieldSection
      title={t("assetEditor.sections.placement")}
      hint={t("assetEditor.sections.placementHint")}
      icon={MapPin}
    >
      {canShowAnchor &&
        (selectedWorkspaceId ? (
          <AnchorSelector
            currentAnchorId={isEditing ? editedData.anchor_id : asset.anchor_id}
            workspaceId={selectedWorkspaceId}
            isEditing={isEditing}
            onAnchorChange={(anchorId) =>
              setEditedData((prev) => ({ ...prev, anchor_id: anchorId }))
            }
          />
        ) : (
          // "All workspaces" 模式下无具体 workspace，锚点关联不可用：给出提示而非静默消失
          <div className="space-y-2">
            <FieldLabel>{t("assetEditor.anchor.title")}</FieldLabel>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("assetEditor.anchor.workspaceRequiredHint")}
            </Text>
          </div>
        ))}

      {showLocation && (
        <AssetLocationEditor
          metadata={asset.metadata}
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
    </FieldSection>
  );
}
