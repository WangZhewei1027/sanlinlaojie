"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Map,
  MapPinned,
  Boxes,
  Clapperboard,
  Camera,
  Building2,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import { useContentModel } from "@/app/manage/lib/content-context";
import {
  useIntegrationText,
  type IntegrationTexts,
} from "@/app/manage/lib/integration-text";
import {
  hasOrgPermission,
  isSidebarItemVisible,
  isSuperAdmin,
} from "@/lib/permissions";

// Same keys and fallbacks as app/manage/components/ContentNav.tsx.
const NAV_TEXTS: IntegrationTexts = {
  "contentModel.integration.nav.assets": ["素材库", "Asset library"],
  "contentModel.integration.nav.scenes": ["场景", "Scenes"],
  "contentModel.integration.nav.map": ["投放地图", "Placement map"],
};

export interface ModuleLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * 登录后导航里的模块入口，按两级权限矩阵门控（仅 UI 显隐，非安全边界）：
 * - /manage/assets、/manage/scenes  已选组织的登录用户（页面自行展示未启用状态）
 * - /manage        所有登录用户（viewer 只读）；组织启用内容模型 v2 后称“投放地图”
 * - /upload-onsite 当前 org 具备 org.assets.write（member 及以上）
 * - /admin         isSidebarItemVisible（org.view）
 * - /super-admin   仅 super_admin
 * orgRole 取自 manage store 当前选中的组织。
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
  const contentModel = useContentModel(enabled ? organizationId : null);

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
  const links: ModuleLink[] = [];
  if (organizationId) {
    links.push(
      {
        href: "/manage/assets",
        label: tx("contentModel.integration.nav.assets"),
        Icon: Boxes,
      },
      {
        href: "/manage/scenes",
        label: tx("contentModel.integration.nav.scenes"),
        Icon: Clapperboard,
      },
    );
  }
  links.push(
    contentModel.state === "v2"
      ? {
          href: "/manage",
          label: tx("contentModel.integration.nav.map"),
          Icon: MapPinned,
        }
      : { href: "/manage", label: t("home.quickLinks.manage.title"), Icon: Map },
  );
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
