"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrgList } from "../components/OrgList";
import { SetOwnerDialog } from "../components/SetOwnerDialog";
import { CreateOrgDialog } from "../components/CreateOrgDialog";

interface MemberData {
  id: string;
  role: string;
  user_id: string;
  users: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}

interface OrgData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  organization_member: MemberData[];
}

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json();
      if (data.data) setOrganizations(data.data);
    } catch (error) {
      console.error("Fetch orgs failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleManageOwner = (org: OrgData) => {
    setSelectedOrg(org);
    setDialogOpen(true);
  };

  const handleDelete = (org: OrgData) => {
    setSelectedOrg(org);
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedOrg) return;
    setDeleteLoading(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result.error || t("common.deleteFailed", "Delete failed"),
        );
      }

      setDeleteDialogOpen(false);
      fetchOrgs();
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : t("common.deleteFailed", "Delete failed"),
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchOrgs();
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
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-7 w-7" />
              <h1 className="text-2xl font-bold">
                {t("superAdmin.orgs.title", "Organization Management")}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t(
                "superAdmin.orgs.description",
                "Manage all organizations and set owners",
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <CreateOrgDialog onSuccess={handleSuccess} />
            <div className="text-right">
              <p className="text-2xl font-bold">{organizations.length}</p>
              <p className="text-sm text-muted-foreground">
                {t("superAdmin.orgs.totalOrgs", "Total")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Org List */}
      <OrgList
        organizations={organizations}
        onManageOwner={handleManageOwner}
        onDelete={handleDelete}
      />

      {/* Set Owner Dialog */}
      {selectedOrg && (
        <SetOwnerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          org={selectedOrg}
          onSuccess={handleSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {t("superAdmin.orgs.deleteDialog.title", "Delete Organization")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "superAdmin.orgs.deleteDialog.description",
                'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
                { name: selectedOrg?.name },
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("common.delete", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
