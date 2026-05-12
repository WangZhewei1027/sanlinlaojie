"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrentOwnersList } from "./CurrentOwnersList";
import { AddOwnerCombobox, type SimpleUser } from "./AddOwnerCombobox";
import { useSetOwnerActions } from "./useSetOwnerActions";
import type { OrgData } from "../../types";

interface SetOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: OrgData;
  onSuccess: () => void;
}

export function SetOwnerDialog({
  open,
  onOpenChange,
  org,
  onSuccess,
}: SetOwnerDialogProps) {
  const { t } = useTranslation();
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  const members = org.organization_member || [];
  const owners = members.filter((m) => m.role === "owner");

  const { loading, error, setError, setOwner, removeOwner } =
    useSetOwnerActions({
      org,
      members,
      onSuccess,
      onClose: () => onOpenChange(false),
    });

  useEffect(() => {
    if (!open) return;
    setError("");
    setFetchLoading(true);

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setAllUsers(data.data);
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  }, [open, setError]);

  const availableUsers = allUsers.filter(
    (u) => !owners.some((o) => o.user_id === u.user_id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t(
              "superAdmin.orgs.setOwnerDialog.title",
              "Set Organization Owner",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              "superAdmin.orgs.setOwnerDialog.description",
              "Manage owners for {{name}}",
              { name: org.name },
            )}
          </DialogDescription>
        </DialogHeader>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <CurrentOwnersList
              owners={owners}
              loading={loading}
              onRemove={removeOwner}
            />
            <AddOwnerCombobox
              availableUsers={availableUsers}
              loading={loading}
              onAdd={setOwner}
            />
            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.close", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
