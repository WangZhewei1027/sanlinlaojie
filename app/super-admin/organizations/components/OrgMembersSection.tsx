"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetOwnerDialog } from "./SetOwnerDialog";
import type { OrgData } from "../types";

interface OrgMembersSectionProps {
  org: OrgData;
  onSuccess: () => void;
}

export function OrgMembersSection({ org, onSuccess }: OrgMembersSectionProps) {
  const { t } = useTranslation();
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);

  const members = org.organization_member ?? [];
  const owners = members.filter((m) => m.role === "owner");
  const nonOwners = members.filter((m) => m.role !== "owner");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Crown className="h-3.5 w-3.5" />
          {t("superAdmin.orgs.currentOwners", "Owners")}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setOwnerDialogOpen(true)}
        >
          {t("superAdmin.orgs.setOwner", "Set Owner")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {owners.length > 0 ? (
          owners.map((owner) => (
            <Badge
              key={owner.id}
              variant="default"
              className="flex items-center gap-1 text-xs py-0"
            >
              <Crown className="h-2.5 w-2.5" />
              {owner.users?.name ||
                owner.users?.email?.split("@")[0] ||
                owner.user_id.slice(0, 8)}
            </Badge>
          ))
        ) : (
          <Badge variant="destructive" className="text-xs py-0">
            {t("superAdmin.orgs.noOwner", "No owner")}
          </Badge>
        )}
      </div>

      {nonOwners.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Users className="h-3 w-3" />
            {t("superAdmin.orgs.members", "Members")} ({nonOwners.length})
          </div>
          {nonOwners.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-muted/40"
            >
              <span className="truncate text-sm">
                {m.users?.name ||
                  m.users?.email?.split("@")[0] ||
                  m.user_id.slice(0, 12)}
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] py-0 ml-2 flex-shrink-0"
              >
                {m.role}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <SetOwnerDialog
        open={ownerDialogOpen}
        onOpenChange={setOwnerDialogOpen}
        org={org}
        onSuccess={onSuccess}
      />
    </section>
  );
}
