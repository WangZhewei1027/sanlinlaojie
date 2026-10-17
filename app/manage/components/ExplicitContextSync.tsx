"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALL_WORKSPACES_ID } from "../constants";
import { ORGANIZATION_PARAM, WORKSPACE_PARAM, readExplicitContext } from "../lib/content-context";

interface ExplicitContextSyncProps {
  loading: boolean;
  organizations: { id: string }[];
  workspaces: { id: string; organization_id?: string }[];
  selectedOrganizationId: string | null;
  selectedWorkspaceId: string | null;
  changeOrganization: (id: string) => Promise<void> | void;
  changeWorkspace: (id: string) => void;
}

/**
 * Keeps the organization/project selectors and an explicit URL context in
 * step. A new `?organizationId=&workspaceId=` is applied to the selectors once
 * (URL wins over the persisted store); after that a selector change made by
 * the user is mirrored back into the URL, so pages that read the URL never
 * disagree with the visible selector. A team switch only rewrites the team:
 * the workspace parameter is dropped, never synthesized from the selection.
 */
export function ExplicitContextSync(props: ExplicitContextSyncProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const explicit = readExplicitContext(params);
  const key = `${explicit.organizationId ?? ""}|${explicit.workspaceId ?? ""}`;
  const appliedKey = useRef<string | null>(null);
  const pendingWorkspace = useRef<string | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const { loading, organizations, workspaces, selectedOrganizationId, selectedWorkspaceId } = props;

  useEffect(() => {
    if (loading || (!explicit.organizationId && !explicit.workspaceId)) return;
    const { changeOrganization, changeWorkspace } = latest.current;

    if (appliedKey.current !== key) {
      // Phase 1: apply the URL to the selectors.
      if (explicit.organizationId && explicit.organizationId !== selectedOrganizationId) {
        if (!organizations.some((organization) => organization.id === explicit.organizationId)) {
          // Not accessible: leave the selectors alone; the page reports the API's 403/404.
          appliedKey.current = key;
          return;
        }
        pendingWorkspace.current = explicit.workspaceId;
        void changeOrganization(explicit.organizationId);
        return;
      }
      const target = explicit.workspaceId ?? pendingWorkspace.current;
      if (target && target !== selectedWorkspaceId) {
        const belongs = target === ALL_WORKSPACES_ID || workspaces.some((workspace) =>
          workspace.id === target && (!workspace.organization_id || workspace.organization_id === selectedOrganizationId));
        if (!belongs) {
          // The org's project list may still be loading; give up once it is loaded without the target.
          if (workspaces.length && workspaces.every((workspace) => workspace.organization_id === selectedOrganizationId)) appliedKey.current = key;
          return;
        }
        changeWorkspace(target);
        return;
      }
      pendingWorkspace.current = null;
      appliedKey.current = key;
      return;
    }

    // Phase 2: the URL was applied; mirror later selector changes into it.
    const organizationChanged = !!explicit.organizationId && !!selectedOrganizationId && explicit.organizationId !== selectedOrganizationId;
    const workspaceChanged = !!explicit.workspaceId && !!selectedWorkspaceId && explicit.workspaceId !== selectedWorkspaceId;
    if (!organizationChanged && !workspaceChanged) return;
    const next = new URLSearchParams(params.toString());
    if (organizationChanged) {
      // A team switch never writes a workspace into the URL: the persisted pick is
      // the new team's first collection, and v2 routes read `workspaceId` as an
      // explicit legacy deep link into that map. Legacy maps fall back to the store.
      next.set(ORGANIZATION_PARAM, selectedOrganizationId);
      next.delete(WORKSPACE_PARAM);
    } else {
      // Same team, legacy switcher on a URL that already names a workspace.
      // Wait until the project list and selection belong to this organization.
      const consistent = selectedWorkspaceId === ALL_WORKSPACES_ID || workspaces.some((workspace) =>
        workspace.id === selectedWorkspaceId && (!workspace.organization_id || workspace.organization_id === selectedOrganizationId));
      if (!consistent) return;
      next.set(WORKSPACE_PARAM, selectedWorkspaceId as string);
    }
    const nextKey = `${next.get(ORGANIZATION_PARAM) ?? ""}|${next.get(WORKSPACE_PARAM) ?? ""}`;
    appliedKey.current = nextKey;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [key, explicit.organizationId, explicit.workspaceId, loading, organizations, workspaces, selectedOrganizationId, selectedWorkspaceId, params, pathname, router]);

  return null;
}
