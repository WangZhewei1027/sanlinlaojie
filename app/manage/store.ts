import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { Organization } from "./types";

interface ManageStore {
  // Current user state
  currentUserRole: string | null;
  setCurrentUserRole: (role: string | null) => void;

  // Organization state
  organizations: Organization[];
  selectedOrganizationId: string | null;
  selectedOrganization: Organization | null;
  organizationLoading: boolean;
  setOrganizations: (organizations: Organization[]) => void;
  setSelectedOrganizationId: (id: string | null) => void;
  setSelectedOrganization: (organization: Organization | null) => void;
  setOrganizationLoading: (loading: boolean) => void;

  // Reset all state (used on auth change)
  reset: () => void;
}

export const useManageStore = create<ManageStore>()(
  devtools(
    persist(
      (set) => ({
        // Current user state
        currentUserRole: null,
        setCurrentUserRole: (role) =>
          set(
            { currentUserRole: role },
            undefined,
            "manage/setCurrentUserRole",
          ),

        // Organization state
        organizations: [],
        selectedOrganizationId: null,
        selectedOrganization: null,
        organizationLoading: false,
        setOrganizations: (organizations) =>
          set({ organizations }, undefined, "manage/setOrganizations"),
        setSelectedOrganizationId: (id) =>
          set(
            { selectedOrganizationId: id },
            undefined,
            "manage/setSelectedOrganizationId",
          ),
        setSelectedOrganization: (organization) =>
          set(
            { selectedOrganization: organization },
            undefined,
            "manage/setSelectedOrganization",
          ),
        setOrganizationLoading: (loading) =>
          set(
            { organizationLoading: loading },
            undefined,
            "manage/setOrganizationLoading",
          ),

        // Reset all state (used on auth change)
        reset: () =>
          set(
            {
              currentUserRole: null,
              organizations: [],
              selectedOrganizationId: null,
              selectedOrganization: null,
              organizationLoading: false,
            },
            undefined,
            "manage/reset",
          ),
      }),
      {
        name: "team-selection",
        partialize: (state) => ({
          selectedOrganizationId: state.selectedOrganizationId,
        }),
      },
    ),
    {
      name: "ManageStore",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
