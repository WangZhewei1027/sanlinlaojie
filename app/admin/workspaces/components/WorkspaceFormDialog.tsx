"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

interface WorkspaceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: {
    id: string;
    name: string;
    description: string | null;
    organization_id?: string;
  };
  defaultOrganizationId?: string;
  defaultOrganizationName?: string;
  onSuccess: () => void;
}

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
  defaultOrganizationId,
  defaultOrganizationName,
  onSuccess,
}: WorkspaceFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(workspace?.name || "");
  const [description, setDescription] = useState(workspace?.description || "");
  const [loading, setLoading] = useState(false);

  const isEditing = !!workspace;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/workspaces/${workspace.id}`
        : "/api/workspaces";
      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, string> = { name, description };
      if (!isEditing && defaultOrganizationId) {
        body.organization_id = defaultOrganizationId;
      }

      await fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      onSuccess();
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch {
      // fetchJson 已弹 toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("admin.workspace.formDialog.editTitle")
                : t("admin.workspace.formDialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t("admin.workspace.formDialog.editDescription")
                : t("admin.workspace.formDialog.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isEditing && defaultOrganizationName && (
              <div className="grid gap-2">
                <Label>{t("admin.organization.label")} *</Label>
                <Input value={defaultOrganizationName} disabled readOnly />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">
                {t("admin.workspace.formDialog.name")} *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("admin.workspace.formDialog.namePlaceholder")}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">
                {t("admin.workspace.formDialog.description")}
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  "admin.workspace.formDialog.descriptionPlaceholder",
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
