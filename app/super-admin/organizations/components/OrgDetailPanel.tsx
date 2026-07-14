"use client";

import { useTranslation } from "react-i18next";
import { Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgSettingsForm } from "@/components/org-settings/OrgSettingsForm";
import { OrgMembersSection } from "./OrgMembersSection";
import { OrgDangerZone } from "./OrgDangerZone";
import { updateOrganization } from "../actions";
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
        <OrgSettingsForm
          org={org}
          save={(payload) => updateOrganization(org.id, payload)}
          onSuccess={onSuccess}
        />

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
