"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useManageStore } from "../store";
import { WORKSPACE_ROUTES } from "./WorkspaceProvider";

export function WorkspaceSelect() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const workspaces = useManageStore((state) => state.workspaces);
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId
  );
  const selectedWorkspace = useManageStore((state) => state.selectedWorkspace);
  const setSelectedWorkspaceId = useManageStore(
    (state) => state.setSelectedWorkspaceId
  );
  const setSelectedWorkspace = useManageStore(
    (state) => state.setSelectedWorkspace
  );
  const loading = useManageStore((state) => state.workspaceLoading);

  // 检查当前路由是否需要显示 WorkspaceSelect
  const shouldShow = WORKSPACE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const handleChange = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    const workspace = workspaces.find((w) => w.id === workspaceId);
    setSelectedWorkspace(workspace || null);
  };

  if (!shouldShow) {
    return null;
  }

  // 加载中或没有工作空间时显示加载状态
  if (loading || workspaces.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-400" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <Select
      value={selectedWorkspaceId || undefined}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-full max-w-[120px] sm:max-w-[240px]">
        <SelectValue placeholder={t("workspace.selectPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
