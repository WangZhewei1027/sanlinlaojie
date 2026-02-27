"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  FolderKanban,
  FolderOpen,
  Calendar,
  Edit,
  Trash2,
} from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import { WorkspaceFormDialog } from "@/app/admin/workspaces/components/WorkspaceFormDialog";
import { DeleteWorkspaceDialog } from "@/app/admin/workspaces/components/DeleteWorkspaceDialog";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  create_date: string | null;
  organization_id?: string;
}

export default function WorkspacesPage() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );

  const fetchWorkspaces = async () => {
    if (!selectedOrganization?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces?organization_id=${selectedOrganization.id}`,
      );
      const result = await response.json();
      if (result.data) {
        setWorkspaces(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrganization?.id) {
      fetchWorkspaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganization?.id]);

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

  if (!selectedOrganization) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t(
            "admin.workspaces.selectOrgFirst",
            "Please select an organization first",
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-48">
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
            <div className="flex items-center gap-3 mb-2">
              <FolderKanban className="h-7 w-7" />
              <h1 className="text-2xl font-bold">
                {t("admin.sidebar.workspaces", "Workspaces")}
              </h1>
              <Badge variant="secondary">{workspaces.length}</Badge>
            </div>
            <p className="text-muted-foreground">
              {t(
                "admin.workspaces.description",
                "Manage workspaces under {{name}}",
                { name: selectedOrganization.name },
              )}
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.workspace.create", "Create Workspace")}
          </Button>
        </div>
      </div>

      {/* Workspace grid */}
      {workspaces.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t("admin.workspace.noWorkspaces", "No workspaces")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "admin.workspace.noWorkspacesHint",
                "Create your first workspace",
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col h-full">
                <div className="flex-1 min-w-0 mb-4">
                  <h3 className="font-semibold text-lg mb-1 truncate">
                    {workspace.name}
                  </h3>
                  {workspace.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {workspace.description}
                    </p>
                  )}
                </div>

                {workspace.create_date && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {t("admin.workspace.createdAt", "Created on")}{" "}
                      {new Date(workspace.create_date).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(workspace)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {t("common.edit", "Edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(workspace)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("common.delete", "Delete")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <WorkspaceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        workspace={selectedWorkspace || undefined}
        defaultOrganizationId={selectedOrganization?.id}
        defaultOrganizationName={selectedOrganization?.name}
        onSuccess={fetchWorkspaces}
      />

      {/* Delete Dialog */}
      {selectedWorkspace && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          workspace={selectedWorkspace}
          onSuccess={fetchWorkspaces}
        />
      )}
    </div>
  );
}
