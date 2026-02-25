"use client";

import { useState, useEffect } from "react";
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
  user: {
    user_id: string;
    name: string | null;
  };
  onSuccess: () => void;
}

export function ManageWorkspaceDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ManageWorkspaceDialogProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      const [workspacesRes, assignmentsRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch(`/api/users/${user.user_id}/workspaces`),
      ]);

      const workspacesData = await workspacesRes.json();
      const assignmentsData = await assignmentsRes.json();

      setWorkspaces(workspacesData.data || []);
      setAssignments(assignmentsData.data || []);
    } catch (err) {
      console.error("获取数据失败:", err);
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

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.user_id}/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspace_id: selectedWorkspace }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "添加失败");
      }

      setSelectedWorkspace("");
      fetchData();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      const response = await fetch(
        `/api/users/${user.user_id}/workspaces?assignment_id=${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "删除失败");
      }

      fetchData();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const availableWorkspaces = workspaces.filter(
    (w) => !assignments.some((a) => a.workspace_id === w.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>管理工作空间访问</DialogTitle>
          <DialogDescription>
            为 <strong>{user.name || "未命名用户"}</strong> 分配工作空间访问权限
          </DialogDescription>
        </DialogHeader>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 添加新的 workspace */}
            {availableWorkspaces.length > 0 && (
              <div className="space-y-2">
                <Label>添加工作空间</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedWorkspace}
                    onValueChange={setSelectedWorkspace}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择工作空间" />
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

            {/* 已分配的 workspaces */}
            <div className="space-y-2">
              <Label>已分配的工作空间</Label>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  暂无分配的工作空间
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

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
