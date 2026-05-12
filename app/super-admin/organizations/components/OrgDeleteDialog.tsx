"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteOrganization } from "../actions";

interface OrgDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  onDeleted: () => void;
}

export function OrgDeleteDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  onDeleted,
}: OrgDeleteDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = (val: boolean) => {
    if (val) setError("");
    onOpenChange(val);
  };

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    const result = await deleteOrganization(orgId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onOpenChange(false);
      onDeleted();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t("superAdmin.orgs.deleteDialog.title", "Delete Organization")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "superAdmin.orgs.deleteDialog.description",
              'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
              { name: orgName },
            )}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t("common.delete", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
