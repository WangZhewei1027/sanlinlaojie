"use client";

import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import type { Asset } from "../../../types";
import { FieldSection } from "../FieldSection";
import { AssetMetadata } from "../fields";

interface AssetEditorAdvancedSectionProps {
  asset: Asset;
}

/**
 * 高级信息分组：完整元数据（可折叠）与资源 ID。
 */
export function AssetEditorAdvancedSection({
  asset,
}: AssetEditorAdvancedSectionProps) {
  const { t } = useTranslation();

  return (
    <FieldSection
      title={t("assetEditor.sections.advanced")}
      hint={t("assetEditor.sections.advancedHint")}
      icon={Info}
      defaultOpen={false}
    >
      <AssetMetadata metadata={asset.metadata} assetId={asset.id} />
    </FieldSection>
  );
}
