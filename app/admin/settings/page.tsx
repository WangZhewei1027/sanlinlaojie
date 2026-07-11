"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings, Loader2, Save, ShieldAlert } from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import { isSuperAdmin, hasOrgPermission } from "@/lib/permissions";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";

export default function SettingsPage() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const setSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );
  const currentUserRole = useManageStore((state) => state.currentUserRole);

  const orgRole = selectedOrganization?.role ?? null;
  const superAdmin = isSuperAdmin(currentUserRole);
  const canEditSettings =
    superAdmin || hasOrgPermission(orgRole, "org.settings");
  const canDeleteOrg = superAdmin || hasOrgPermission(orgRole, "org.delete");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedOrganization) {
      setName(selectedOrganization.name);
      setDescription(selectedOrganization.description || "");
    }
  }, [selectedOrganization]);

  const handleSave = async () => {
    if (!selectedOrganization?.id || !name.trim()) return;

    setSuccess(false);
    setSaving(true);

    try {
      await fetchJson(`/api/organizations/${selectedOrganization.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      // Update store
      setSelectedOrganization({
        ...selectedOrganization,
        name: name.trim(),
        description: description.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // fetchJson 已弹 toast
    } finally {
      setSaving(false);
    }
  };

  if (!selectedOrganization) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t(
            "admin.settings.selectOrgFirst",
            "Please select an organization first",
          )}
        </div>
      </div>
    );
  }

  // 页面级 guard：只有 owner / super_admin 能管理组织设置或删除组织
  if (!canEditSettings && !canDeleteOrg) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-10 w-10" />
          <p>{t("admin.settings.noPermission", "你没有权限管理此组织设置")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-7 w-7" />
          <h1 className="text-2xl font-bold">
            {t("admin.settings.title", "Settings")}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {t(
            "admin.settings.description",
            "Manage organization settings for {{name}}",
            { name: selectedOrganization.name },
          )}
        </p>
      </div>

      {/* General settings */}
      <div className="border rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold">
          {t("admin.settings.general", "General")}
        </h2>

        <div className="space-y-2">
          <Label htmlFor="org-name">
            {t("admin.settings.orgName", "Organization Name")}
          </Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.settings.orgNamePlaceholder", "Enter name")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-desc">
            {t("admin.settings.orgDescription", "Description")}
          </Label>
          <Textarea
            id="org-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(
              "admin.settings.orgDescPlaceholder",
              "Optional description",
            )}
            rows={3}
          />
        </div>

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {t("admin.settings.saved", "Settings saved successfully")}
          </div>
        )}

        {canEditSettings && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("common.save", "Save")}
            </Button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      {canDeleteOrg && (
        <div className="border border-destructive/30 rounded-lg p-6 mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-destructive">
            {t("admin.settings.dangerZone", "Danger Zone")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "admin.settings.deleteWarning",
              "Deleting an organization will remove all associated data. This action cannot be undone.",
            )}
          </p>
          <DeleteOrgButton
            orgId={selectedOrganization.id}
            orgName={selectedOrganization.name}
          />
        </div>
      )}
    </div>
  );
}

function DeleteOrgButton({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetchJson(`/api/organizations/${orgId}`, { method: "DELETE" });
      // Reload after deletion
      window.location.href = "/admin";
    } catch {
      // fetchJson 已弹 toast
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-destructive">
          {t(
            "admin.settings.confirmDelete",
            'Type "{{name}}" to confirm deletion',
            { name: orgName },
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("common.delete", "Delete")}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="destructive" onClick={() => setConfirming(true)}>
      {t("admin.settings.deleteOrg", "Delete Organization")}
    </Button>
  );
}
