"use client";

import { useTranslation } from "react-i18next";
import { Sliders } from "lucide-react";
import { isFieldEditable } from "../../../config";
import type { Asset } from "../../../types";
import type { AssetEditedData } from "../hooks/useAssetEditor";
import { FieldSection } from "../FieldSection";
import { AssetEditorModelConfigFields } from "../AssetEditorModelConfigFields";
import { AssetEditorTextStyleFields } from "../AssetEditorTextStyleFields";

interface AssetEditorAppearanceSectionProps {
  asset: Asset;
  isEditing: boolean;
  editedData: AssetEditedData;
  setEditedData: React.Dispatch<React.SetStateAction<AssetEditedData>>;
}

/**
 * 外观样式分组：模型缩放 / 大型模型开关、文字颜色与大小。
 * 仅在对应类型（model / text）下渲染。
 */
export function AssetEditorAppearanceSection({
  asset,
  isEditing,
  editedData,
  setEditedData,
}: AssetEditorAppearanceSectionProps) {
  const { t } = useTranslation();

  const showModelConfig =
    isFieldEditable(asset.file_type, "is_huge") ||
    isFieldEditable(asset.file_type, "scale_multiplier");
  const showTextStyle = isFieldEditable(asset.file_type, "text_color");

  if (!showModelConfig && !showTextStyle) return null;

  return (
    <FieldSection
      title={t("assetEditor.sections.appearance")}
      hint={t("assetEditor.sections.appearanceHint")}
      icon={Sliders}
    >
      {showModelConfig && (
        <AssetEditorModelConfigFields
          asset={asset}
          isEditing={isEditing}
          isHuge={editedData.is_huge}
          scaleMultiplier={editedData.scale_multiplier}
          onIsHugeChange={(value) =>
            setEditedData((prev) => ({ ...prev, is_huge: value }))
          }
          onScaleMultiplierChange={(value) =>
            setEditedData((prev) => ({ ...prev, scale_multiplier: value }))
          }
        />
      )}

      {showTextStyle && (
        <AssetEditorTextStyleFields
          asset={asset}
          isEditing={isEditing}
          textColor={editedData.text_color}
          textSize={editedData.text_size}
          onTextColorChange={(value) =>
            setEditedData((prev) => ({ ...prev, text_color: value }))
          }
          onTextSizeChange={(value) =>
            setEditedData((prev) => ({ ...prev, text_size: value }))
          }
        />
      )}
    </FieldSection>
  );
}
