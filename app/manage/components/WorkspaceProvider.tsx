"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useManageStore } from "../store";

// Routes that need organization/workspace context loaded
const WORKSPACE_ROUTES = ["/manage", "/upload-onsite", "/display", "/admin"];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldShowWorkspace = WORKSPACE_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  // Read persisted selections from the Zustand store at mount time only.
  // `persist` middleware hydrates the store synchronously on client, so these
  // values will already reflect the last user choice on the first render.
  const [initialOrgId] = useState(
    () => useManageStore.getState().selectedOrganizationId,
  );
  const [initialWorkspaceId] = useState(
    () => useManageStore.getState().selectedWorkspaceId,
  );

  const {
    organizations,
    selectedOrganizationId,
    selectedOrganization,
    setSelectedOrganizationId: handleOrganizationChange,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setPreferredWorkspaceId,
    currentUserRole,
    loading,
  } = useWorkspace(initialOrgId, initialWorkspaceId);

  // Current user store setter
  const setStoreCurrentUserRole = useManageStore(
    (state) => state.setCurrentUserRole,
  );

  // Organization store setters
  const setStoreOrganizations = useManageStore(
    (state) => state.setOrganizations,
  );
  const setStoreSelectedOrganizationId = useManageStore(
    (state) => state.setSelectedOrganizationId,
  );
  const setStoreSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );
  const setStoreOrganizationLoading = useManageStore(
    (state) => state.setOrganizationLoading,
  );

  // Workspace store setters
  const setStoreWorkspaces = useManageStore((state) => state.setWorkspaces);
  const setStoreSelectedWorkspaceId = useManageStore(
    (state) => state.setSelectedWorkspaceId,
  );
  const setStoreSelectedWorkspace = useManageStore(
    (state) => state.setSelectedWorkspace,
  );
  const setStoreWorkspaceLoading = useManageStore(
    (state) => state.setWorkspaceLoading,
  );

  // ── Org switcher: store → hook ──────────────────────────────────────────
  // When the OrgSwitcher component writes directly to the Zustand store, we
  // detect the divergence here and relay the change into useWorkspace so it
  // can re-fetch workspaces for the new org.
  const storeOrgId = useManageStore((state) => state.selectedOrganizationId);
  const orgSyncInitRef = useRef(false);

  useEffect(() => {
    // Skip the very first run – at that point WorkspaceProvider hasn't yet
    // pushed the hook's initial value into the store, so any divergence is
    // expected and should not trigger a redundant fetch.
    if (!orgSyncInitRef.current) {
      orgSyncInitRef.current = true;
      return;
    }
    if (
      shouldShowWorkspace &&
      storeOrgId &&
      storeOrgId !== selectedOrganizationId
    ) {
      handleOrganizationChange(storeOrgId);
    }
  }, [
    storeOrgId,
    selectedOrganizationId,
    handleOrganizationChange,
    shouldShowWorkspace,
  ]);

  // ── Workspace switcher → hook ref ─────────────────────────────────────
  // WorkspaceSwitcher writes to the store directly. Keep the hook's
  // preference ref in sync so re-initialisation (e.g. TOKEN_REFRESHED)
  // restores the correct workspace.
  const storeWorkspaceId = useManageStore((state) => state.selectedWorkspaceId);
  const wsSyncInitRef = useRef(false);

  useEffect(() => {
    if (!wsSyncInitRef.current) {
      wsSyncInitRef.current = true;
      return;
    }
    if (shouldShowWorkspace && storeWorkspaceId !== selectedWorkspaceId) {
      setPreferredWorkspaceId(storeWorkspaceId);
    }
  }, [
    storeWorkspaceId,
    selectedWorkspaceId,
    setPreferredWorkspaceId,
    shouldShowWorkspace,
  ]);

  // ── Sync hook state → store ─────────────────────────────────────────────

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreCurrentUserRole(currentUserRole);
    }
  }, [currentUserRole, setStoreCurrentUserRole, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreOrganizations(organizations);
    }
  }, [organizations, setStoreOrganizations, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreSelectedOrganizationId(selectedOrganizationId);
    }
  }, [
    selectedOrganizationId,
    setStoreSelectedOrganizationId,
    shouldShowWorkspace,
  ]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreSelectedOrganization(selectedOrganization ?? null);
    }
  }, [selectedOrganization, setStoreSelectedOrganization, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreOrganizationLoading(loading);
    }
  }, [loading, setStoreOrganizationLoading, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreWorkspaces(workspaces);
    }
  }, [workspaces, setStoreWorkspaces, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreSelectedWorkspaceId(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, setStoreSelectedWorkspaceId, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreSelectedWorkspace(selectedWorkspace ?? null);
    }
  }, [selectedWorkspace, setStoreSelectedWorkspace, shouldShowWorkspace]);

  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreWorkspaceLoading(loading);
    }
  }, [loading, setStoreWorkspaceLoading, shouldShowWorkspace]);

  return <>{children}</>;
}

export { WORKSPACE_ROUTES };
