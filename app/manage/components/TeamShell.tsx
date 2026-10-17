"use client";

import type { ReactNode } from "react";
import { isSidebarItemVisible } from "@/lib/permissions";
import { useManageStore } from "../store";
import { ContentListSkeleton } from "../content/ContentFeedback";
import { TeamFrame } from "./TeamFrame";

/** Whether the current user sees anything under 团队设置 (members or settings). */
export function useCanSeeTeamSettings() {
  const globalRole = useManageStore((state) => state.currentUserRole);
  const orgRole = useManageStore((state) => state.selectedOrganization?.role ?? null);
  return isSidebarItemVisible("/admin/members", globalRole, orgRole) || isSidebarItemVisible("/admin/settings", globalRole, orgRole);
}

/** Console frame of the team pages: primary navigation, then the page. */
export function TeamShell({ organizationId, aside, children }: { organizationId: string | null; aside?: ReactNode; children: ReactNode }) {
  const showSettings = useCanSeeTeamSettings();
  const teamName = useManageStore((state) => state.organizations.find((team) => team.id === organizationId)?.name);
  return (
    <TeamFrame organizationId={organizationId} teamName={teamName} showSettings={showSettings} aside={aside}>
      {children}
    </TeamFrame>
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
