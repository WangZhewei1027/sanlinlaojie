"use client";

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "../SectionHeader";
import type { TextAssetMiniappStyle } from "@/app/manage/types";

interface TextAssetStyleSectionProps {
  textAssetMiniappStyle: TextAssetMiniappStyle;
  setTextAssetMiniappStyle: (v: TextAssetMiniappStyle) => void;
}

export function TextAssetStyleSection({
  textAssetMiniappStyle,
  setTextAssetMiniappStyle,
}: TextAssetStyleSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <SectionHeader
        icon={FileText}
        label={t(
          "superAdmin.orgs.section.textAssetStyle",
          "Text Asset Style (Mini Program)",
        )}
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "superAdmin.orgs.textAsset.styleDesc",
          "Controls how text-type assets are displayed in the WeChat Mini Program",
        )}
      </p>
      <Select
        value={textAssetMiniappStyle}
        onValueChange={(v) =>
          setTextAssetMiniappStyle(v as TextAssetMiniappStyle)
        }
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="plain_white">
            {t("superAdmin.orgs.textAsset.plain_white", "Plain White Text")}
          </SelectItem>
          <SelectItem value="dialog_decorated">
            {t(
              "superAdmin.orgs.textAsset.dialog_decorated",
              "Dialog Decorated",
            )}
          </SelectItem>
        </SelectContent>
      </Select>
    </section>
  );
}
