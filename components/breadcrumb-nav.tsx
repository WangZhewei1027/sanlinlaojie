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
import { buildBreadcrumbItems } from "@/components/breadcrumb-routes";
import { useManageStore } from "@/app/manage/store";
import { WORKSPACE_ROUTES, isPathWithinRoutes } from "@/app/manage/constants";
import { useContentModel } from "@/app/manage/lib/content-context";
import { cn } from "@/lib/utils";

// Legacy teams only: the old asset map and onsite upload still pick a workspace
// in the header. Teams on content model v2 (or frozen as readonly) have no
// global workspace; collections are chosen on their own pages.
const LEGACY_WORKSPACE_SWITCHER_PATHS = ["/manage", "/upload-onsite"];

export function BreadcrumbNav() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();

  const organizations = useManageStore((state) => state.organizations);
  const selectedOrganizationId = useManageStore(
    (state) => state.selectedOrganizationId,
  );
  const organizationLoading = useManageStore(
    (state) => state.organizationLoading,
  );

  const isOrgContextRoute = isPathWithinRoutes(pathname, WORKSPACE_ROUTES);
  // Hide the whole switcher block (incl. its separator) when OrgSwitcher
  // itself would render nothing — otherwise two separators sit side by side.
  const showOrgSwitcher =
    isOrgContextRoute && (organizationLoading || organizations.length > 0);
  const contentModel = useContentModel(
    isOrgContextRoute ? selectedOrganizationId : null,
  );
  const legacyTeam =
    contentModel.status === "ready" &&
    contentModel.state !== "v2" &&
    contentModel.state !== "readonly";
  const showWorkspace =
    legacyTeam && LEGACY_WORKSPACE_SWITCHER_PATHS.includes(pathname);

  const breadcrumbItems = buildBreadcrumbItems(pathname, t, i18n.language);

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-0.5 sm:gap-1">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            // Home stays a link even when it is the only crumb (e.g. /auth/*)
            const isCurrentPage = isLast && index > 0;
            return (
              <Fragment key={item.href}>
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
                  {isCurrentPage ? (
                    <BreadcrumbPage className="truncate whitespace-nowrap font-medium">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="whitespace-nowrap">
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}

          {/* Workspace switcher for the legacy map and onsite upload */}
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

      {/* Legacy teams: workspace QR in the header. v2 teams show it on each collection. */}
      {isOrgContextRoute && legacyTeam && <WorkspaceQrButton />}
    </div>
  );
}
