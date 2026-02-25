"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useManageStore } from "../store";
import { WORKSPACE_ROUTES } from "./WorkspaceProvider";

export function OrganizationSelect() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const organizations = useManageStore((state) => state.organizations);
  const selectedOrganizationId = useManageStore(
    (state) => state.selectedOrganizationId,
  );
  const setSelectedOrganizationId = useManageStore(
    (state) => state.setSelectedOrganizationId,
  );
  const setSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );
  const loading = useManageStore((state) => state.organizationLoading);

  const shouldShow = WORKSPACE_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  const handleChange = (orgId: string) => {
    setSelectedOrganizationId(orgId);
    const org = organizations.find((o) => o.id === orgId);
    setSelectedOrganization(org || null);
  };

  if (!shouldShow) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-400" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }
  if (organizations.length === 0) return null;

  // 只有一个 org 时不显示选择器，但显示名称
  if (organizations.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <span className="truncate max-w-[120px] sm:max-w-[200px]">
          {organizations[0].name}
        </span>
      </div>
    );
  }

  return (
    <Select
      value={selectedOrganizationId || undefined}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-full max-w-[120px] sm:max-w-[200px]">
        <SelectValue placeholder={t("organization.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
