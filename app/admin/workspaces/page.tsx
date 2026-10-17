"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderKanban, FolderOpen } from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import { isSuperAdmin, hasOrgPermission } from "@/lib/permissions";
import { WorkspaceFormDialog } from "@/app/admin/workspaces/components/WorkspaceFormDialog";
import { DeleteWorkspaceDialog } from "@/app/admin/workspaces/components/DeleteWorkspaceDialog";
import { WorkspacesSkeleton } from "@/app/admin/workspaces/components/WorkspacesSkeleton";
import { Text } from "@/components/ui/typography";
import { useContentModel } from "@/app/manage/lib/content-context";
import { useIntegrationText } from "@/app/manage/lib/integration-text";
import { ProjectMembersDialog } from "@/app/admin/workspaces/components/ProjectMembersDialog";
import { WorkspaceCard, type WorkspaceCardData } from "@/app/admin/workspaces/components/WorkspaceCard";
import { WORKSPACE_TEXTS } from "@/app/admin/workspaces/workspace-texts";

type Workspace = WorkspaceCardData;

export default function WorkspacesPage() {
  const { t } = useTranslation();
  const tx = useIntegrationText(WORKSPACE_TEXTS);
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const currentUserRole = useManageStore((state) => state.currentUserRole);

  const orgRole = selectedOrganization?.role ?? null;
  const superAdmin = isSuperAdmin(currentUserRole);
  const canCreate =
    superAdmin || hasOrgPermission(orgRole, "org.workspaces.create");
  const canEdit = superAdmin || hasOrgPermission(orgRole, "org.workspaces.edit");
  const canDelete =
    superAdmin || hasOrgPermission(orgRole, "org.workspaces.delete");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );
  const [membersWorkspace, setMembersWorkspace] = useState<Workspace | null>(
    null,
  );
  const [membersOpen, setMembersOpen] = useState(false);
  // Server-declared content model state; v2 swaps delete for archive/restore.
  const contentModel = useContentModel(selectedOrganization?.id ?? null);
  const lifecycle =
    contentModel.status !== "ready"
      ? "unknown"
      : contentModel.state === "v2"
        ? "v2"
        : "legacy";

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

  const handleMembers = (workspace: Workspace) => {
    setMembersWorkspace(workspace);
    setMembersOpen(true);
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
    return <WorkspacesSkeleton />;
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FolderKanban className="h-7 w-7" />
              <Text as="h1" variant="headingLg" fontWeight="bold">
                {t("admin.sidebar.workspaces", "Workspaces")}
              </Text>
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
          {canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.workspace.create", "Create Workspace")}
            </Button>
          )}
        </div>
      </div>

      {/* Workspace grid */}
      {workspaces.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <Text as="h3" variant="headingMd" className="mb-2">
              {t("admin.workspace.noWorkspaces", "No workspaces")}
            </Text>
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
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              lifecycle={lifecycle}
              canEdit={canEdit}
              canDelete={canDelete}
              createdAtLabel={t("admin.workspace.createdAt", "Created on")}
              onEdit={() => handleEdit(workspace)}
              onDelete={() => handleDelete(workspace)}
              onMembers={() => handleMembers(workspace)}
              tx={tx}
            />
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

      {/* Project members (capabilities come from the server) */}
      <ProjectMembersDialog
        workspace={membersWorkspace}
        open={membersOpen}
        onOpenChange={setMembersOpen}
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
