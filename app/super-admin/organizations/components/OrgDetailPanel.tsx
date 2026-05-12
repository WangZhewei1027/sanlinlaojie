"use client";

import { useTranslation } from "react-i18next";
import { Building2, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgBasicInfoFields } from "./OrgBasicInfoFields";
import { OrgFormSections } from "./OrgFormSections";
import { OrgMembersSection } from "./OrgMembersSection";
import { OrgDangerZone } from "./OrgDangerZone";
import { useOrgDetailForm } from "../hooks/useOrgDetailForm";
import type { OrgData } from "../types";

interface OrgDetailPanelProps {
  org: OrgData;
  onClose: () => void;
  onSuccess: () => void;
  onDeleted: () => void;
}

export function OrgDetailPanel({
  org,
  onClose,
  onSuccess,
  onDeleted,
}: OrgDetailPanelProps) {
  const { t } = useTranslation();
  const {
    name,
    setName,
    description,
    setDescription,
    lat,
    setLat,
    lng,
    setLng,
    fileTypes,
    toggleFileType,
    textAssetMiniappStyle,
    setTextAssetMiniappStyle,
    saveError,
    hasChanged,
    handleSave,
    isPending,
  } = useOrgDetailForm(org, onSuccess);

  return (
    <div className="flex flex-col h-full">
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {t("superAdmin.orgs.details", "Organization Details")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">
        <OrgBasicInfoFields
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
        />

        <OrgFormSections
          lat={lat}
          setLat={setLat}
          lng={lng}
          setLng={setLng}
          fileTypes={fileTypes}
          toggleFileType={toggleFileType}
          textAssetMiniappStyle={textAssetMiniappStyle}
          setTextAssetMiniappStyle={setTextAssetMiniappStyle}
        />

        <div className="border-t" />

        {/* ── Save button + error ── */}
        <div className="space-y-2">
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <Button
            onClick={handleSave}
            disabled={!hasChanged || !name.trim() || isPending}
            size="sm"
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2" />
            )}
            {t("superAdmin.orgs.saveChanges", "Save Changes")}
          </Button>
        </div>

        <div className="border-t" />

        <OrgMembersSection org={org} onSuccess={onSuccess} />

        <p className="text-[10px] text-muted-foreground/50 font-mono break-all pt-1">
          ID: {org.id}
        </p>
      </div>

      <OrgDangerZone orgId={org.id} orgName={org.name} onDeleted={onDeleted} />
    </div>
  );
}
