import type { TFunction } from "i18next";

export interface BreadcrumbCrumb {
  label: string;
  href: string;
}

// Full-path → i18n key. Keyed by path rather than segment so the same
// segment (e.g. "settings") can resolve differently per console, and
// dynamic segments (UUIDs, tokens) simply never match.
const PATH_LABELS: Record<string, string> = {
  "/manage": "nav.manage",
  "/upload-onsite": "nav.upload",
  "/settings": "settings.title",
  "/admin": "nav.admin",
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

/**
 * Builds the breadcrumb trail for a pathname: always starts with Home,
 * then one crumb per mapped path prefix. Every crumb carries its href;
 * the renderer decides which one is the current page.
 */
export function buildBreadcrumbItems(
  pathname: string,
  t: TFunction,
): BreadcrumbCrumb[] {
  const items: BreadcrumbCrumb[] = [{ label: t("nav.home"), href: "/" }];

  let currentPath = "";
  for (const segment of pathname.split("/").filter(Boolean)) {
    currentPath += `/${segment}`;
    const labelKey = PATH_LABELS[currentPath];
    if (labelKey) {
      items.push({ label: t(labelKey, segment), href: currentPath });
    }
  }

  return items;
}
