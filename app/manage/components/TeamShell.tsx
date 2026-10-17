"use client";

import type { ReactNode } from "react";
import { isSidebarItemVisible } from "@/lib/permissions";
import { useManageStore } from "../store";
import { ContentListSkeleton } from "../content/ContentFeedback";
import { ContentNav } from "./ContentNav";

/** Whether the current user sees anything under 团队设置 (members or settings). */
export function useCanSeeTeamSettings() {
  const globalRole = useManageStore((state) => state.currentUserRole);
  const orgRole = useManageStore((state) => state.selectedOrganization?.role ?? null);
  return isSidebarItemVisible("/admin/members", globalRole, orgRole) || isSidebarItemVisible("/admin/settings", globalRole, orgRole);
}

/** Console frame of the team pages: primary navigation, then the page. */
export function TeamShell({ organizationId, aside, children }: { organizationId: string | null; aside?: ReactNode; children: ReactNode }) {
  const showSettings = useCanSeeTeamSettings();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <ContentNav organizationId={organizationId} showSettings={showSettings} />
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </main>
  );
}

/** Row skeleton for a team page whose state is still loading. */
export function TeamPageLoading({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <ContentListSkeleton label={label} />
    </div>
  );
}
