"use client";

import { useTranslation } from "react-i18next";
import { FileType2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionHeader } from "../SectionHeader";
import { ALL_FILE_TYPES } from "../../hooks/useOrgDetailForm";

interface FileTypesSectionProps {
  fileTypes: Set<string>;
  toggleFileType: (type: string) => void;
}

export function FileTypesSection({
  fileTypes,
  toggleFileType,
}: FileTypesSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader
          icon={FileType2}
          label={t("superAdmin.orgs.section.fileTypes", "Allowed File Types")}
        />
        <span className="text-xs text-muted-foreground">
          {fileTypes.size === ALL_FILE_TYPES.length
            ? t("superAdmin.orgs.fileTypes.all", "All")
            : `${fileTypes.size} / ${ALL_FILE_TYPES.length}`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
        {ALL_FILE_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <Checkbox
              id={`ft-${type}`}
              checked={fileTypes.has(type)}
              onCheckedChange={() => toggleFileType(type)}
            />
            <Label
              htmlFor={`ft-${type}`}
              className="text-sm font-normal cursor-pointer"
            >
              {t(`fileTypes.${type}`, type)}
            </Label>
          </div>
        ))}
      </div>
    </section>
  );
}
