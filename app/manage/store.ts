import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Asset, Workspace, LocationData } from "./types";

interface ManageStore {
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
  assetsLoading: boolean;
  setAssets: (assets: Asset[]) => void;
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
}

export const useManageStore = create<ManageStore>()(
  devtools(
    (set) => ({
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
          "manage/setSelectedWorkspaceId"
        ),
      setSelectedWorkspace: (workspace) =>
        set(
          { selectedWorkspace: workspace },
          undefined,
          "manage/setSelectedWorkspace"
        ),
      setWorkspaceLoading: (loading) =>
        set(
          { workspaceLoading: loading },
          undefined,
          "manage/setWorkspaceLoading"
        ),

      // Assets state
      assets: [],
      assetsLoading: false,
      setAssets: (assets) => set({ assets }, undefined, "manage/setAssets"),
      setAssetsLoading: (loading) =>
        set({ assetsLoading: loading }, undefined, "manage/setAssetsLoading"),
      updateAsset: (id, updates) =>
        set(
          (state) => ({
            assets: state.assets.map((asset) =>
              asset.id === id ? { ...asset, ...updates } : asset
            ),
          }),
          undefined,
          "manage/updateAsset"
        ),
      deleteAsset: (id) =>
        set(
          (state) => ({
            assets: state.assets.filter((asset) => asset.id !== id),
          }),
          undefined,
          "manage/deleteAsset"
        ),

      // Viewer state
      clickedLocation: null,
      focusedAssetId: null,
      selectedAssetId: null,
      setClickedLocation: (location) =>
        set(
          { clickedLocation: location },
          undefined,
          "manage/setClickedLocation"
        ),
      setFocusedAssetId: (id) =>
        set({ focusedAssetId: id }, undefined, "manage/setFocusedAssetId"),
      setSelectedAssetId: (id) =>
        set({ selectedAssetId: id }, undefined, "manage/setSelectedAssetId"),
    }),
    {
      name: "ManageStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
