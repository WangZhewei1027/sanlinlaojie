"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useManageStore } from "../store";

// 配置哪些路由需要显示 WorkspaceSelect
const WORKSPACE_ROUTES = [
  "/manage",
  "/upload-onsite",
  "/display",
  "/admin/workspace",
];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldShowWorkspace = WORKSPACE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const { workspaces, selectedWorkspaceId, selectedWorkspace, loading } =
    useWorkspace();

  const setStoreWorkspaces = useManageStore((state) => state.setWorkspaces);
  const setStoreSelectedWorkspaceId = useManageStore(
    (state) => state.setSelectedWorkspaceId
  );
  const setStoreSelectedWorkspace = useManageStore(
    (state) => state.setSelectedWorkspace
  );
  const setStoreWorkspaceLoading = useManageStore(
    (state) => state.setWorkspaceLoading
  );

  // 只在需要的路由加载 workspace 数据
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
