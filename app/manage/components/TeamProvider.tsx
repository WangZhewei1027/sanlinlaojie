"use client";

import { useTeam } from "@/hooks/useTeam";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { TEAM_ROUTES, isPathWithinRoutes } from "../constants";
import { readExplicitContext } from "../lib/content-context";
import { useManageStore } from "../store";
import { ExplicitContextSync } from "./ExplicitContextSync";

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldShowTeam = isPathWithinRoutes(pathname, TEAM_ROUTES);

  // The explicit team in the URL wins over the persisted selection.
  // wins over the persisted store (shared links, other tabs). Otherwise read
  // the persisted choice; `persist` hydrates synchronously on the client.
  const [initialExplicit] = useState(() =>
    typeof window === "undefined"
      ? { organizationId: null, workspaceId: null }
      : readExplicitContext(new URLSearchParams(window.location.search)),
  );
  const [initialOrgId] = useState(
    () =>
      initialExplicit.organizationId ??
      useManageStore.getState().selectedOrganizationId,
  );

  const {
    organizations,
    selectedOrganizationId,
    selectedOrganization,
    setSelectedOrganizationId: handleOrganizationChange,
    currentUserRole,
    loading,
  } = useTeam(initialOrgId);

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

  const publishingSelectionRef = useRef(false);

  useEffect(() => {
    if (!shouldShowTeam) return;

    return useManageStore.subscribe((state, previousState) => {
      if (publishingSelectionRef.current) return;

      if (
        state.selectedOrganizationId &&
        state.selectedOrganizationId !== previousState.selectedOrganizationId
      ) {
        void handleOrganizationChange(state.selectedOrganizationId);
      }
    });
  }, [
    handleOrganizationChange,
    shouldShowTeam,
  ]);

  // ── Sync hook state → store ─────────────────────────────────────────────

  useEffect(() => {
    if (shouldShowTeam) {
      setStoreCurrentUserRole(currentUserRole);
    }
  }, [currentUserRole, setStoreCurrentUserRole, shouldShowTeam]);

  useEffect(() => {
    if (shouldShowTeam) {
      setStoreOrganizations(organizations);
    }
  }, [organizations, setStoreOrganizations, shouldShowTeam]);

  useEffect(() => {
    if (shouldShowTeam) {
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
    shouldShowTeam,
  ]);

  useEffect(() => {
    if (shouldShowTeam) {
      setStoreSelectedOrganization(selectedOrganization ?? null);
    }
  }, [selectedOrganization, setStoreSelectedOrganization, shouldShowTeam]);

  useEffect(() => {
    if (shouldShowTeam) {
      setStoreOrganizationLoading(loading);
    }
  }, [loading, setStoreOrganizationLoading, shouldShowTeam]);


  return (
    <>
      {shouldShowTeam && (
        <Suspense fallback={null}>
          <ExplicitContextSync
            loading={loading}
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            changeOrganization={handleOrganizationChange}
          />
        </Suspense>
      )}
      {children}
    </>
  );
}
