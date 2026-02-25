"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings, Loader2, Save, AlertTriangle } from "lucide-react";
import { useManageStore } from "@/app/manage/store";

export default function SettingsPage() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const setSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedOrganization) {
      setName(selectedOrganization.name);
      setDescription(selectedOrganization.description || "");
    }
  }, [selectedOrganization]);

  const handleSave = async () => {
    if (!selectedOrganization?.id || !name.trim()) return;

    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const response = await fetch(
        `/api/organizations/${selectedOrganization.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to update organization");

      // Update store
      setSelectedOrganization({
        ...selectedOrganization,
        name: name.trim(),
        description: description.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {t("admin.settings.saved", "Settings saved successfully")}
          </div>
        )}

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
      </div>

      {/* Danger zone */}
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
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to delete organization");

      // Reload after deletion
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
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
        {error && <p className="text-sm text-red-600">{error}</p>}
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
