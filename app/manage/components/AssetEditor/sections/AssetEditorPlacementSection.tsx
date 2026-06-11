"use client";

import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { isFieldEditable, type AssetTypeConfig } from "../../../config";
import type { Asset } from "../../../types";
import type { AssetEditedData } from "../hooks/useAssetEditor";
import { FieldSection } from "../FieldSection";
import { AnchorSelector, AssetLocationEditor } from "../fields";

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

  const showAnchor =
    isFieldEditable(asset.file_type, "anchor_id") && !!selectedWorkspaceId;
  const showLocation = isFieldEditable(asset.file_type, "location");

  if (!showAnchor && !showLocation) return null;

  return (
    <FieldSection
      title={t("assetEditor.sections.placement")}
      hint={t("assetEditor.sections.placementHint")}
      icon={MapPin}
    >
      {showAnchor && selectedWorkspaceId && (
        <AnchorSelector
          currentAnchorId={isEditing ? editedData.anchor_id : asset.anchor_id}
          workspaceId={selectedWorkspaceId}
          isEditing={isEditing}
          onAnchorChange={(anchorId) =>
            setEditedData((prev) => ({ ...prev, anchor_id: anchorId }))
          }
        />
      )}

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
