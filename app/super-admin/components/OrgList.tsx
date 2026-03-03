"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Users, Crown } from "lucide-react";

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

export interface OrgData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  organization_member: MemberData[];
  map_center: { lat: number; lng: number } | null;
  allowed_file_types: string[] | null;
}

interface OrgListProps {
  organizations: OrgData[];
  selectedOrgId?: string | null;
  onSelectOrg: (org: OrgData) => void;
}

export function OrgList({
  organizations,
  selectedOrgId,
  onSelectOrg,
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {organizations.map((org) => {
        const members = org.organization_member || [];
        const owners = members.filter((m) => m.role === "owner");
        const isSelected = selectedOrgId === org.id;

        return (
          <Card
            key={org.id}
            onClick={() => onSelectOrg(org)}
            className={cn(
              "p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
              isSelected && "border-primary ring-2 ring-primary/20 shadow-md",
            )}
          >
            <div className="flex items-start gap-3 mb-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                {org.name}
              </h3>
            </div>

            {org.description && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {org.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{new Date(org.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{members.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {owners.length > 0 ? (
                owners.slice(0, 2).map((owner) => (
                  <Badge
                    key={owner.id}
                    variant="default"
                    className="flex items-center gap-1 text-xs py-0"
                  >
                    <Crown className="h-2.5 w-2.5" />
                    <span className="max-w-[80px] truncate">
                      {owner.users?.name ||
                        owner.users?.email?.split("@")[0] ||
                        owner.user_id.slice(0, 8)}
                    </span>
                  </Badge>
                ))
              ) : (
                <Badge variant="destructive" className="text-xs py-0">
                  {t("superAdmin.orgs.noOwner", "No owner")}
                </Badge>
              )}
              {owners.length > 2 && (
                <Badge variant="secondary" className="text-xs py-0">
                  +{owners.length - 2}
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
