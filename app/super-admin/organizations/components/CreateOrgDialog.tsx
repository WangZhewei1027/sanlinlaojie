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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";

interface CreateOrgDialogProps {
  onSuccess: () => void;
}

export function CreateOrgDialog({ onSuccess }: CreateOrgDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(
          result.error || t("common.createFailed", "Create failed"),
        );
      }

      setName("");
      setDescription("");
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.createFailed", "Create failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          {t("superAdmin.orgs.createOrg", "New Organization")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("superAdmin.orgs.createDialog.title", "Create Organization")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "superAdmin.orgs.createDialog.description",
                "You will be set as the owner of this organization.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">
                {t("superAdmin.orgs.createDialog.name", "Name")}
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(
                  "superAdmin.orgs.createDialog.namePlaceholder",
                  "Organization name",
                )}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-desc">
                {t("superAdmin.orgs.createDialog.desc", "Description")}
              </Label>
              <Textarea
                id="org-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  "superAdmin.orgs.createDialog.descPlaceholder",
                  "Optional description",
                )}
                rows={3}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.create", "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
