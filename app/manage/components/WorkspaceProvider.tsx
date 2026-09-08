"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useManageStore } from "../store";
import { WORKSPACE_ROUTES, isPathWithinRoutes } from "../constants";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldShowWorkspace = isPathWithinRoutes(pathname, WORKSPACE_ROUTES);

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
    setSelectedWorkspaceId: setHookSelectedWorkspaceId,
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

  // Only relay actual external store changes into the hook. Comparing two
  // render snapshots in opposing effects swaps old/new IDs on every render
  // when useWorkspace selects a default after a fetch.
  const publishingSelectionRef = useRef(false);

  useEffect(() => {
    if (!shouldShowWorkspace) return;

    return useManageStore.subscribe((state, previousState) => {
      if (publishingSelectionRef.current) return;

      if (
        state.selectedOrganizationId &&
        state.selectedOrganizationId !== previousState.selectedOrganizationId
      ) {
        void handleOrganizationChange(state.selectedOrganizationId);
      }
      if (state.selectedWorkspaceId !== previousState.selectedWorkspaceId) {
        setPreferredWorkspaceId(state.selectedWorkspaceId);
        setHookSelectedWorkspaceId(state.selectedWorkspaceId);
      }
    });
  }, [
    handleOrganizationChange,
    setPreferredWorkspaceId,
    setHookSelectedWorkspaceId,
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
      publishingSelectionRef.current = true;
      try {
        setStoreSelectedOrganizationId(selectedOrganizationId);
      } finally {
        publishingSelectionRef.current = false;
      }
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
      publishingSelectionRef.current = true;
      try {
        setStoreSelectedWorkspaceId(selectedWorkspaceId);
      } finally {
        publishingSelectionRef.current = false;
      }
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
