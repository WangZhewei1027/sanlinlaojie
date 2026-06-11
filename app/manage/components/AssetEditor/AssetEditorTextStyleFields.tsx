"use client";

import { useTranslation } from "react-i18next";
import type { Asset } from "../../types";
import { isFieldEditable } from "../../config";
import { FieldLabel } from "./FieldLabel";

interface AssetEditorTextStyleFieldsProps {
  asset: Asset;
  isEditing: boolean;
  textColor: string;
  textSize: string;
  onTextColorChange: (value: string) => void;
  onTextSizeChange: (value: string) => void;
}

export function AssetEditorTextStyleFields({
  asset,
  isEditing,
  textColor,
  textSize,
  onTextColorChange,
  onTextSizeChange,
}: AssetEditorTextStyleFieldsProps) {
  const { t } = useTranslation();

  if (!isFieldEditable(asset.file_type, "text_color")) return null;

  return (
    <>
      <div className="space-y-2">
        <FieldLabel>{t("assetEditor.fields.textColor")}</FieldLabel>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={textColor || "#ffffff"}
              onChange={(e) => onTextColorChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background px-1 py-1 shadow-sm"
            />
            <span className="text-sm text-muted-foreground">
              {textColor || "#ffffff"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {asset.config?.text_color ? (
              <>
                <span
                  className="inline-block h-4 w-4 rounded-sm border border-border"
                  style={{ backgroundColor: asset.config.text_color }}
                />
                <p className="text-sm">{asset.config.text_color}</p>
              </>
            ) : (
              <p className="text-sm p-3 bg-muted/40 rounded-md">
                {t("assetEditor.fields.textColorDefault")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <FieldLabel>{t("assetEditor.fields.textSize")}</FieldLabel>
        {isEditing ? (
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={textSize}
            onChange={(e) => onTextSizeChange(e.target.value)}
            placeholder={t("assetEditor.fields.textSizePlaceholder")}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : (
          <p className="text-sm p-3 bg-muted/40 rounded-md">
            {asset.config?.text_size ?? t("assetEditor.fields.textSizeDefault")}
          </p>
        )}
      </div>
    </>
  );
}
