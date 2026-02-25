"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { WorkspaceList } from "./components/WorkspaceList";
import { WorkspaceFormDialog } from "./components/WorkspaceFormDialog";
import { DeleteWorkspaceDialog } from "./components/DeleteWorkspaceDialog";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  create_date: string | null;
}

export default function WorkspaceManagePage() {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces");
      const result = await response.json();
      if (result.data) {
        setWorkspaces(result.data);
      }
    } catch (error) {
      console.error("获取工作空间失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = () => {
    setSelectedWorkspace(null);
    setFormOpen(true);
  };

  const handleEdit = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setFormOpen(true);
  };

  const handleDelete = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setDeleteOpen(true);
  };

  const handleSuccess = () => {
    fetchWorkspaces();
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t("admin.workspace.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.workspace.description")}
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.workspace.create")}
          </Button>
        </div>
      </div>

      {/* Workspace List */}
      <WorkspaceList
        workspaces={workspaces}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Form Dialog */}
      <WorkspaceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        workspace={selectedWorkspace || undefined}
        onSuccess={handleSuccess}
      />

      {/* Delete Dialog */}
      {selectedWorkspace && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          workspace={selectedWorkspace}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
