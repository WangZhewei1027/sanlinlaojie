import type { TFunction } from "i18next";

export interface BreadcrumbCrumb {
  label: string;
  href: string;
}

// Full-path → i18n key. Keyed by path rather than segment so the same
// segment (e.g. "settings") can resolve differently per console, and
// dynamic segments (UUIDs, tokens) simply never match.
const PATH_LABELS: Record<string, string> = {
  "/manage": "contentModel.integration.nav.workbench",
  "/manage/assets": "contentModel.integration.nav.assets",
  "/manage/scenes": "contentModel.integration.nav.scenes",
  "/manage/collections": "contentModel.integration.nav.collections",
  "/upload-onsite": "nav.upload",
  "/settings": "settings.title",
  "/admin": "contentModel.integration.nav.settings",
  "/admin/members": "admin.sidebar.members",
  "/admin/workspaces": "admin.sidebar.workspaces",
  "/admin/settings": "admin.sidebar.settings",
  "/super-admin": "superAdmin.title",
  "/super-admin/users": "superAdmin.sidebar.users",
  "/super-admin/organizations": "superAdmin.sidebar.organizations",
  "/super-admin/error-logs": "superAdmin.sidebar.errorLogs",
  "/super-admin/clean": "superAdmin.sidebar.cleanup",
  "/super-admin/settings": "superAdmin.sidebar.settings",
};

// zh/en fallbacks for label keys the locale files may not carry yet.
// Same keys and wording as app/manage/components/ContentNav.tsx.
const LABEL_FALLBACKS: Record<string, readonly [zh: string, en: string]> = {
  "contentModel.integration.nav.workbench": ["工作台", "Workbench"],
  "contentModel.integration.nav.assets": ["素材", "Assets"],
  "contentModel.integration.nav.scenes": ["场景", "Scenes"],
  "contentModel.integration.nav.collections": ["合集", "Collections"],
  "contentModel.integration.nav.settings": ["团队设置", "Team settings"],
};

/**
 * Builds the breadcrumb trail for a pathname: always starts with Home,
 * then one crumb per mapped path prefix. Every crumb carries its href;
 * the renderer decides which one is the current page. `language` picks
 * the zh/en fallback for keys that are missing from the locale files.
 */
export function buildBreadcrumbItems(
  pathname: string,
  t: TFunction,
  language?: string,
): BreadcrumbCrumb[] {
  const english = language?.startsWith("en") ?? false;
  const items: BreadcrumbCrumb[] = [{ label: t("nav.home"), href: "/" }];

  let currentPath = "";
  for (const segment of pathname.split("/").filter(Boolean)) {
    currentPath += `/${segment}`;
    const labelKey = PATH_LABELS[currentPath];
    if (labelKey) {
      const fallback = LABEL_FALLBACKS[labelKey];
      const label = fallback
        ? t(labelKey, { defaultValue: fallback[english ? 1 : 0] })
        : t(labelKey, segment);
      items.push({ label, href: currentPath });
    }
  }

  return items;
}
