"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrgDeleteDialog } from "./OrgDeleteDialog";

interface OrgDangerZoneProps {
  orgId: string;
  orgName: string;
  onDeleted: () => void;
}

export function OrgDangerZone({
  orgId,
  orgName,
  onDeleted,
}: OrgDangerZoneProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-4 mt-2 border-t">
      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-2" />
        {t("superAdmin.orgs.deleteOrg", "Delete Organization")}
      </Button>

      <OrgDeleteDialog
        open={open}
        onOpenChange={setOpen}
        orgId={orgId}
        orgName={orgName}
        onDeleted={onDeleted}
      />
    </div>
  );
}
