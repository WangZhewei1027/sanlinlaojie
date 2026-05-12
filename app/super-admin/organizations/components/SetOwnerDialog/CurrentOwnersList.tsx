"use client";

import { useTranslation } from "react-i18next";
import { Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { MemberData } from "../../types";

interface CurrentOwnersListProps {
  owners: MemberData[];
  loading: boolean;
  onRemove: (memberId: string) => void;
}

export function CurrentOwnersList({
  owners,
  loading,
  onRemove,
}: CurrentOwnersListProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t("superAdmin.orgs.currentOwners", "Current Owners")}</Label>
      {owners.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("superAdmin.orgs.noOwner", "No owner")}
        </p>
      ) : (
        <div className="space-y-2">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">
                  {owner.users?.name || owner.users?.email || owner.user_id}
                </span>
                {owner.users?.email && owner.users?.name && (
                  <span className="text-xs text-muted-foreground">
                    {owner.users.email}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(owner.id)}
                disabled={loading}
                title={t("superAdmin.orgs.demoteToMember", "Demote to member")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
