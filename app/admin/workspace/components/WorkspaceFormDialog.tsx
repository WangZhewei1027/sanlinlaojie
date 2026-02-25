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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

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
  onSuccess: () => void;
}

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
  defaultOrganizationId,
  onSuccess,
}: WorkspaceFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(workspace?.name || "");
  const [description, setDescription] = useState(workspace?.description || "");
  const [organizationId, setOrganizationId] = useState(
    workspace?.organization_id || defaultOrganizationId || "",
  );
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!workspace;

  useEffect(() => {
    if (open) {
      fetch("/api/organizations")
        .then((res) => res.json())
        .then((result) => {
          const orgs = result.data || [];
          setOrganizations(orgs);
          // Use defaultOrganizationId if provided, otherwise auto-select first
          if (!organizationId && orgs.length > 0) {
            const defaultOrg = defaultOrganizationId
              ? orgs.find((o: Organization) => o.id === defaultOrganizationId)
              : null;
            setOrganizationId(defaultOrg?.id || orgs[0].id);
          }
        })
        .catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/workspaces/${workspace.id}`
        : "/api/workspaces";
      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, string> = { name, description };
      if (!isEditing) {
        body.organization_id = organizationId;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "操作失败");
      }

      onSuccess();
      onOpenChange(false);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
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
            {!isEditing && organizations.length > 0 && (
              <div className="grid gap-2">
                <Label>{t("admin.organization.label")} *</Label>
                <Select
                  value={organizationId}
                  onValueChange={setOrganizationId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("admin.organization.selectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
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
