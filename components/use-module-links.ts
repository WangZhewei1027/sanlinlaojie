"use client";

import {
  useIntegrationText,
  type IntegrationTexts,
} from "@/app/manage/lib/integration-text";
import { useManageStore } from "@/app/manage/store";
import {
  hasOrgPermission,
  isSidebarItemVisible,
  isSuperAdmin,
} from "@/lib/permissions";
import {
  Camera,
  LayoutGrid,
  MapPinned,
  Settings2,
  Shield,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// Same keys and fallbacks as app/manage/components/ContentNav.tsx.
const NAV_TEXTS: IntegrationTexts = {
  "contentModel.integration.nav.workbench": ["工作台", "Workbench"],
  "contentModel.integration.nav.collections": ["合集", "Collections"],
  "contentModel.integration.nav.settings": ["团队设置", "Team settings"],
};

export interface ModuleLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * 登录后导航里的模块入口，按两级权限矩阵门控（仅 UI 显隐，非安全边界）：
 * - /manage                 工作台：团队全部素材与场景（v2/readonly）；旧模型团队仍是旧版素材地图
 * - /manage/collections     合集：团队的地图合集（v2/readonly）
 * - /upload-onsite          现场上传：当前团队具备 org.assets.write（member 及以上）
 * - /admin                  团队设置：能看到成员或设置页时显示
 * - /super-admin            仅 super_admin
 * orgRole 取自 manage store 当前选中的团队。
 */
export function useModuleLinks(enabled: boolean): ModuleLink[] {
  const { t } = useTranslation();
  const [globalRole, setGlobalRole] = useState<string | null>(null);
  const tx = useIntegrationText(NAV_TEXTS);
  const orgRole = useManageStore(
    (state) => state.selectedOrganization?.role ?? null,
  );
  const organizationId = useManageStore(
    (state) => state.selectedOrganization?.id ?? null,
  );
  // Cached per organization; null while signed out issues no request.

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
  const links: ModuleLink[] = [{ href: "/manage", label: tx("contentModel.integration.nav.workbench"), Icon: LayoutGrid }];
  if (organizationId) {
    links.push({
      href: "/manage/collections",
      label: tx("contentModel.integration.nav.collections"),
      Icon: MapPinned,
    });
  }
  if (superAdmin || hasOrgPermission(orgRole, "org.assets.write")) {
    links.push({
      href: "/upload-onsite",
      label: t("home.quickLinks.onsite.title"),
      Icon: Camera,
    });
  }
  if (
    isSidebarItemVisible("/admin/members", globalRole, orgRole) ||
    isSidebarItemVisible("/admin/settings", globalRole, orgRole)
  ) {
    links.push({
      href: "/admin",
      label: tx("contentModel.integration.nav.settings"),
      Icon: Settings2,
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
