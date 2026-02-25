"use client";

import { useTranslation } from "react-i18next";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useManageStore } from "@/app/manage/store";

export function OrgSwitcher() {
  const { t } = useTranslation();

  const organizations = useManageStore((state) => state.organizations);
  const selectedOrganizationId = useManageStore(
    (state) => state.selectedOrganizationId,
  );
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const setSelectedOrganizationId = useManageStore(
    (state) => state.setSelectedOrganizationId,
  );
  const setSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );
  const loading = useManageStore((state) => state.organizationLoading);

  const handleSelect = (orgId: string) => {
    setSelectedOrganizationId(orgId);
    const org = organizations.find((o) => o.id === orgId);
    setSelectedOrganization(org || null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <span className="hidden sm:inline">{t("common.loading")}</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 px-2 py-1.5 h-auto font-medium text-sm max-w-[180px]"
        >
          <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedOrganization?.name ||
              t("organization.selectPlaceholder", "Select organization")}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>
          {t("organization.switchTitle", "Organizations")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSelect(org.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{org.name}</span>
            </div>
            {org.id === selectedOrganizationId && (
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
