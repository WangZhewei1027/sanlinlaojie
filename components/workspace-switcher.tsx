"use client";

import { useTranslation } from "react-i18next";
import { FolderKanban, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useManageStore } from "@/app/manage/store";

export function WorkspaceSwitcher() {
  const { t } = useTranslation();

  const workspaces = useManageStore((state) => state.workspaces);
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId,
  );
  const selectedWorkspace = useManageStore((state) => state.selectedWorkspace);
  const setSelectedWorkspaceId = useManageStore(
    (state) => state.setSelectedWorkspaceId,
  );
  const setSelectedWorkspace = useManageStore(
    (state) => state.setSelectedWorkspace,
  );
  const loading = useManageStore((state) => state.workspaceLoading);

  const handleSelect = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    const workspace = workspaces.find((w) => w.id === workspaceId);
    setSelectedWorkspace(workspace || null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("workspace.noAssigned", "No workspace")}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 px-2 py-1.5 h-auto font-medium text-sm max-w-[160px]"
        >
          <FolderKanban className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedWorkspace?.name ||
              t("workspace.selectPlaceholder", "Select workspace")}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>
          {t("workspace.selectPlaceholder", "Workspaces")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => handleSelect(ws.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="truncate">{ws.name}</span>
            {ws.id === selectedWorkspaceId && (
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
