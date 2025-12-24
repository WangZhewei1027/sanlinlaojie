"use client";

import { usePathname } from "next/navigation";
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

  if (!shouldShow || workspaces.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedWorkspaceId || undefined}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="选择工作空间..." />
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
