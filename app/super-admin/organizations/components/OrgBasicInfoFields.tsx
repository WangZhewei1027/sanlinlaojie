"use client";

import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "./SectionHeader";

interface OrgBasicInfoFieldsProps {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}

export function OrgBasicInfoFields({
  name,
  setName,
  description,
  setDescription,
}: OrgBasicInfoFieldsProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Building2}
        label={t("superAdmin.orgs.section.basicInfo", "Basic Info")}
      />
      <div className="space-y-2">
        <Label htmlFor="org-name" className="text-xs">
          {t("superAdmin.orgs.createDialog.name", "Name")}
        </Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(
            "superAdmin.orgs.createDialog.namePlaceholder",
            "Organization name",
          )}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-desc" className="text-xs">
          {t("superAdmin.orgs.createDialog.desc", "Description")}
        </Label>
        <Textarea
          id="org-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            "superAdmin.orgs.createDialog.descPlaceholder",
            "Optional description",
          )}
          rows={2}
          className="resize-none text-sm"
        />
      </div>
    </section>
  );
}
