"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrgSwitcher } from "@/components/org-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Map route segments to i18n keys
const ROUTE_LABELS: Record<string, string> = {
  admin: "nav.admin",
  manage: "nav.manage",
  "upload-onsite": "nav.upload",
  workspace: "admin.sidebar.workspaces",
  workspaces: "admin.sidebar.workspaces",
  members: "admin.sidebar.members",
  settings: "admin.sidebar.settings",
  users: "admin.sidebar.users",
  clean: "admin.sidebar.cleanup",
  organizations: "admin.sidebar.organizations",
};

// Routes that should show the org switcher in the breadcrumb
const ORG_CONTEXT_ROUTES = ["/admin", "/manage", "/upload-onsite"];

// Routes that should show workspace switcher
const WORKSPACE_CONTEXT_ROUTES = ["/manage", "/upload-onsite"];

export function BreadcrumbNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);

  // Check if current route needs org or workspace context
  const showOrgSwitcher = ORG_CONTEXT_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const showWorkspace = WORKSPACE_CONTEXT_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // Build breadcrumb items from route segments
  const breadcrumbItems: BreadcrumbItem[] = [];

  // Always start with Home
  breadcrumbItems.push({ label: t("nav.home"), href: "/" });

  // Build path segments
  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip dynamic segments like UUIDs
    if (segment.match(/^[0-9a-f-]{36}$/)) continue;

    const labelKey = ROUTE_LABELS[segment];
    if (labelKey) {
      const isLast = i === segments.length - 1;
      breadcrumbItems.push({
        label: t(labelKey, segment),
        href: isLast ? undefined : currentPath,
      });
    }
  }

  return (
    <div className="flex items-center gap-1 min-w-0 flex-1 text-sm">
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center gap-1 min-w-0">
          {index > 0 && (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
          )}

          {/* After Home, insert org switcher if applicable */}
          {index === 1 && showOrgSwitcher && (
            <>
              <OrgSwitcher />
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
            </>
          )}

          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground whitespace-nowrap truncate">
              {item.label}
            </span>
          )}
        </div>
      ))}

      {/* Show workspace switcher for workspace-scoped routes */}
      {showWorkspace && (
        <div className="flex items-center gap-1 min-w-0">
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
          <WorkspaceSwitcher />
        </div>
      )}
    </div>
  );
}
