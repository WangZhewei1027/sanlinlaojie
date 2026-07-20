"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Map, Camera, Building2, Shield, type LucideIcon } from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import {
  hasOrgPermission,
  isSidebarItemVisible,
  isSuperAdmin,
} from "@/lib/permissions";

export interface ModuleLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * 登录后导航里的模块入口，按两级权限矩阵门控（仅 UI 显隐，非安全边界）：
 * - /manage        所有登录用户（viewer 只读）
 * - /upload-onsite 当前 org 具备 org.assets.write（member 及以上）
 * - /admin         isSidebarItemVisible（org.view）
 * - /super-admin   仅 super_admin
 * orgRole 取自 manage store 当前选中的组织。
 */
export function useModuleLinks(enabled: boolean): ModuleLink[] {
  const { t } = useTranslation();
  const [globalRole, setGlobalRole] = useState<string | null>(null);
  const orgRole = useManageStore(
    (state) => state.selectedOrganization?.role ?? null,
  );

  useEffect(() => {
    if (!enabled) {
      setGlobalRole(null);
      return;
    }
    let active = true;
    fetch("/api/auth/role")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.role) setGlobalRole(data.role);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled) return [];

  const superAdmin = isSuperAdmin(globalRole);
  const links: ModuleLink[] = [
    { href: "/manage", label: t("home.quickLinks.manage.title"), Icon: Map },
  ];
  if (superAdmin || hasOrgPermission(orgRole, "org.assets.write")) {
    links.push({
      href: "/upload-onsite",
      label: t("home.quickLinks.onsite.title"),
      Icon: Camera,
    });
  }
  if (isSidebarItemVisible("/admin", globalRole, orgRole)) {
    links.push({
      href: "/admin",
      label: t("home.quickLinks.admin.title"),
      Icon: Building2,
    });
  }
  if (superAdmin) {
    links.push({
      href: "/super-admin",
      label: t("home.quickLinks.superAdmin.title"),
      Icon: Shield,
    });
  }
  return links;
}
