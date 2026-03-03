import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { Asset, Workspace, LocationData, Organization } from "./types";

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

  // Workspace state
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: Workspace | null;
  workspaceLoading: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setSelectedWorkspaceId: (id: string | null) => void;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  setWorkspaceLoading: (loading: boolean) => void;

  // Assets state
  assets: Asset[];
  filteredAssets: Asset[]; // 经过标签过滤后的资产列表
  assetsLoading: boolean;
  setAssets: (assets: Asset[]) => void;
  setFilteredAssets: (assets: Asset[]) => void;
  setAssetsLoading: (loading: boolean) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  // Viewer state
  clickedLocation: LocationData | null;
  focusedAssetId: string | null;
  selectedAssetId: string | null;
  setClickedLocation: (location: LocationData | null) => void;
  setFocusedAssetId: (id: string | null) => void;
  setSelectedAssetId: (id: string | null) => void;

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

        // Workspace state
        workspaces: [],
        selectedWorkspaceId: null,
        selectedWorkspace: null,
        workspaceLoading: false,
        setWorkspaces: (workspaces) =>
          set({ workspaces }, undefined, "manage/setWorkspaces"),
        setSelectedWorkspaceId: (id) =>
          set(
            { selectedWorkspaceId: id },
            undefined,
            "manage/setSelectedWorkspaceId",
          ),
        setSelectedWorkspace: (workspace) =>
          set(
            { selectedWorkspace: workspace },
            undefined,
            "manage/setSelectedWorkspace",
          ),
        setWorkspaceLoading: (loading) =>
          set(
            { workspaceLoading: loading },
            undefined,
            "manage/setWorkspaceLoading",
          ),

        // Assets state
        assets: [],
        filteredAssets: [], // 初始为空数组
        assetsLoading: false,
        setAssets: (assets) => set({ assets }, undefined, "manage/setAssets"),
        setFilteredAssets: (assets) =>
          set(
            { filteredAssets: assets },
            undefined,
            "manage/setFilteredAssets",
          ),
        setAssetsLoading: (loading) =>
          set({ assetsLoading: loading }, undefined, "manage/setAssetsLoading"),
        updateAsset: (id, updates) =>
          set(
            (state) => ({
              assets: state.assets.map((asset) =>
                asset.id === id ? { ...asset, ...updates } : asset,
              ),
            }),
            undefined,
            "manage/updateAsset",
          ),
        deleteAsset: (id) =>
          set(
            (state) => ({
              assets: state.assets.filter((asset) => asset.id !== id),
            }),
            undefined,
            "manage/deleteAsset",
          ),

        // Viewer state
        clickedLocation: null,
        focusedAssetId: null,
        selectedAssetId: null,
        setClickedLocation: (location) =>
          set(
            { clickedLocation: location },
            undefined,
            "manage/setClickedLocation",
          ),
        setFocusedAssetId: (id) =>
          set({ focusedAssetId: id }, undefined, "manage/setFocusedAssetId"),
        setSelectedAssetId: (id) =>
          set({ selectedAssetId: id }, undefined, "manage/setSelectedAssetId"),

        // Reset all state (used on auth change)
        reset: () =>
          set(
            {
              currentUserRole: null,
              organizations: [],
              selectedOrganizationId: null,
              selectedOrganization: null,
              organizationLoading: false,
              workspaces: [],
              selectedWorkspaceId: null,
              selectedWorkspace: null,
              workspaceLoading: false,
              assets: [],
              filteredAssets: [],
              assetsLoading: false,
              clickedLocation: null,
              focusedAssetId: null,
              selectedAssetId: null,
            },
            undefined,
            "manage/reset",
          ),
      }),
      {
        name: "manage-store",
        partialize: (state) => ({
          selectedOrganizationId: state.selectedOrganizationId,
          selectedWorkspaceId: state.selectedWorkspaceId,
        }),
      },
    ),
    {
      name: "ManageStore",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
