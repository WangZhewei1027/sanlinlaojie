"use client";

import { useEffect, useRef } from "react";
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

  const {
    organizations,
    selectedOrganizationId,
    selectedOrganization,
    setSelectedOrganizationId: handleOrganizationChange,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    currentUserRole,
    loading,
  } = useWorkspace();

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

  // Watch for org changes from OrgSwitcher (store) and refetch workspaces
  const storeOrgId = useManageStore((state) => state.selectedOrganizationId);
  const orgChangeRef = useRef(false);

  useEffect(() => {
    // Skip the initial sync (WorkspaceProvider sets the store value first)
    if (!orgChangeRef.current) {
      orgChangeRef.current = true;
      return;
    }
    // When store orgId diverges from hook's internal value, it was changed externally (OrgSwitcher)
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

  // Sync current user role to store
  useEffect(() => {
    if (shouldShowWorkspace) {
      setStoreCurrentUserRole(currentUserRole);
    }
  }, [currentUserRole, setStoreCurrentUserRole, shouldShowWorkspace]);

  // Sync organization data to store
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

  // Sync workspace data to store
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
