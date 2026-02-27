"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Users, Crown, Trash2 } from "lucide-react";

interface MemberData {
  id: string;
  role: string;
  user_id: string;
  users: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}

interface OrgData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  organization_member: MemberData[];
}

interface OrgListProps {
  organizations: OrgData[];
  onManageOwner: (org: OrgData) => void;
  onDelete: (org: OrgData) => void;
}

export function OrgList({
  organizations,
  onManageOwner,
  onDelete,
}: OrgListProps) {
  const { t } = useTranslation();

  if (organizations.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t("superAdmin.orgs.noOrgs", "No organizations")}
          </h3>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {organizations.map((org) => {
        const members = org.organization_member || [];
        const owners = members.filter((m) => m.role === "owner");

        return (
          <Card key={org.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-lg truncate">{org.name}</h3>
                </div>

                {org.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {org.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(org.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>
                      {members.length} {t("superAdmin.orgs.members", "members")}
                    </span>
                  </div>
                </div>

                {/* Current owners */}
                <div className="flex flex-wrap gap-2">
                  {owners.map((owner) => (
                    <Badge
                      key={owner.id}
                      variant="default"
                      className="flex items-center gap-1"
                    >
                      <Crown className="h-3 w-3" />
                      {owner.users?.name || owner.users?.email || owner.user_id}
                    </Badge>
                  ))}
                  {owners.length === 0 && (
                    <Badge variant="destructive">
                      {t("superAdmin.orgs.noOwner", "No owner")}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground/75 font-mono truncate mt-3">
                  ID: {org.id}
                </p>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageOwner(org)}
                >
                  <Crown className="h-4 w-4 mr-1" />
                  {t("superAdmin.orgs.setOwner", "Set Owner")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(org)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("common.delete", "Delete")}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
