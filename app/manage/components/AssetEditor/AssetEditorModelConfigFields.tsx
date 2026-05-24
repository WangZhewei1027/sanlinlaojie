"use client";

import { useTranslation } from "react-i18next";
import type { Asset } from "../../types";
import { isFieldEditable, getFieldLabel } from "../../config";

interface AssetEditorModelConfigFieldsProps {
  asset: Asset;
  isEditing: boolean;
  isHuge: boolean;
  scaleMultiplier: string;
  onIsHugeChange: (value: boolean) => void;
  onScaleMultiplierChange: (value: string) => void;
}

export function AssetEditorModelConfigFields({
  asset,
  isEditing,
  isHuge,
  scaleMultiplier,
  onIsHugeChange,
  onScaleMultiplierChange,
}: AssetEditorModelConfigFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      {isFieldEditable(asset.file_type, "is_huge") && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_huge"
            checked={isEditing ? isHuge : (asset.is_huge ?? false)}
            onChange={(e) => onIsHugeChange(e.target.checked)}
            disabled={!isEditing}
            className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50"
          />
          <label htmlFor="is_huge" className="text-sm font-medium leading-none">
            {t(
              getFieldLabel(
                asset.file_type,
                "is_huge",
                "assetEditor.fields.isHuge",
              ),
            )}
          </label>
        </div>
      )}

      {isFieldEditable(asset.file_type, "scale_multiplier") && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("assetEditor.fields.scaleMultiplier")}
          </label>
          {isEditing ? (
            <input
              type="number"
              step="0.1"
              min="0.01"
              value={scaleMultiplier}
              onChange={(e) => onScaleMultiplierChange(e.target.value)}
              placeholder={t("assetEditor.fields.scaleMultiplierPlaceholder")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : (
            <p className="text-sm p-3 bg-background rounded-md">
              {asset.config?.scale_multiplier ??
                t("assetEditor.fields.scaleMultiplierDefault")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
