"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/fetch-json";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
}

interface Assignment {
  id: string;
  workspace_id: string;
  role: string;
  workspace: Workspace;
}

interface ManageWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  user: {
    user_id: string;
    name: string | null;
  };
  onSuccess: () => void;
}

export function ManageWorkspaceDialog({
  open,
  onOpenChange,
  organizationId,
  user,
  onSuccess,
}: ManageWorkspaceDialogProps) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const [workspacesRes, assignmentsRes] = await Promise.all([
        fetch(`/api/workspaces?organization_id=${organizationId}`),
        fetch(`/api/users/${user.user_id}/workspaces`),
      ]);

      const workspacesData = await workspacesRes.json();
      const assignmentsData = await assignmentsRes.json();

      const orgWorkspaces: Workspace[] = workspacesData.data || [];
      const allAssignments: Assignment[] = assignmentsData.data || [];

      setWorkspaces(orgWorkspaces);
      // Only show assignments that belong to this organization's workspaces
      const orgWorkspaceIds = new Set(orgWorkspaces.map((w) => w.id));
      setAssignments(
        allAssignments.filter((a) => orgWorkspaceIds.has(a.workspace_id)),
      );
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAdd = async () => {
    if (!selectedWorkspace) return;

    setLoading(true);
    try {
      await fetchJson(`/api/users/${user.user_id}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: selectedWorkspace }),
      });

      setSelectedWorkspace("");
      fetchData();
      onSuccess();
    } catch {
      // fetchJson 已弹 toast
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await fetchJson(
        `/api/users/${user.user_id}/workspaces?assignment_id=${assignmentId}`,
        { method: "DELETE" },
      );

      fetchData();
      onSuccess();
    } catch {
      // fetchJson 已弹 toast
    }
  };

  const availableWorkspaces = workspaces.filter(
    (w) => !assignments.some((a) => a.workspace_id === w.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t(
              "admin.members.workspaceDialog.title",
              "Manage Workspace Access",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              "admin.members.workspaceDialog.description",
              "Assign workspace access for {{name}}",
              {
                name: user.name || t("admin.members.unnamed", "Unnamed user"),
              },
            )}
          </DialogDescription>
        </DialogHeader>

        {fetchLoading ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add workspace */}
            {availableWorkspaces.length > 0 && (
              <div className="space-y-2">
                <Label>
                  {t(
                    "admin.members.workspaceDialog.addWorkspace",
                    "Add Workspace",
                  )}
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedWorkspace}
                    onValueChange={setSelectedWorkspace}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue
                        placeholder={t(
                          "admin.members.workspaceDialog.selectWorkspace",
                          "Select workspace",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAdd}
                    disabled={!selectedWorkspace || loading}
                    size="icon"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Assigned workspaces */}
            <div className="space-y-2">
              <Label>
                {t(
                  "admin.members.workspaceDialog.assignedWorkspaces",
                  "Assigned Workspaces",
                )}
              </Label>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t(
                    "admin.members.workspaceDialog.noAssignedWorkspaces",
                    "No assigned workspaces",
                  )}
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {assignment.workspace.name}
                        </p>
                        {assignment.workspace.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {assignment.workspace.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(assignment.id)}
                        className="flex-shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("admin.members.workspaceDialog.close", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
