"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { OrgSwitcher } from "@/components/org-switcher";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { WorkspaceQrButton } from "@/components/workspace-qr-button";
import { cn } from "@/lib/utils";

interface CrumbItem {
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
  const breadcrumbItems: CrumbItem[] = [];

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
    <div className="flex min-w-0 flex-1 items-center">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-0.5 sm:gap-1">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <Fragment key={index}>
                {index > 0 && (
                  <BreadcrumbSeparator
                    className={cn(
                      "text-muted-foreground/60",
                      // On mobile everything left of this separator is hidden,
                      // except the org-switcher chain leading to the current page
                      !(index > 1 && isLast && showOrgSwitcher) &&
                        "hidden sm:inline-flex",
                    )}
                  />
                )}

                {/* After Home, insert org switcher if applicable */}
                {index === 1 && showOrgSwitcher && (
                  <>
                    <BreadcrumbItem>
                      <OrgSwitcher />
                    </BreadcrumbItem>
                    <BreadcrumbSeparator
                      className={cn(
                        "text-muted-foreground/60",
                        !isLast && "hidden sm:inline-flex",
                      )}
                    />
                  </>
                )}

                <BreadcrumbItem
                  className={cn(
                    "min-w-0",
                    // On mobile, hide Home and intermediate links to leave
                    // room for switchers
                    !isLast && "hidden sm:inline-flex",
                  )}
                >
                  {item.href ? (
                    <BreadcrumbLink asChild className="whitespace-nowrap">
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate whitespace-nowrap font-medium">
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}

          {/* Show workspace switcher for workspace-scoped routes */}
          {showWorkspace && (
            <>
              <BreadcrumbSeparator className="text-muted-foreground/60" />
              <BreadcrumbItem className="min-w-0">
                <WorkspaceSwitcher />
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* QR code button on the right side, when an org is selected on org-scoped routes */}
      {showOrgSwitcher && <WorkspaceQrButton />}
    </div>
  );
}
