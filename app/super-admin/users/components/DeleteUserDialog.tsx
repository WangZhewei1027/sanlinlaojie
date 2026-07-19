"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Crown, Trash2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson, ApiError } from "@/lib/fetch-json";
import type { UserData } from "../types";
import { displayAccount } from "@/lib/phone-email";

interface OrgConsequence {
  id: string;
  name: string;
  memberCount: number;
  action: "none" | "promote" | "delete";
  successor?: {
    user_id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
  workspaceCount?: number;
  assetCount?: number;
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: DeleteUserDialogProps) {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgConsequence[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrgs(null);
    setPreviewError("");
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/users/${user.user_id}/deletion-preview`,
        );
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPreviewError(
            body?.error || t("admin.users.deleteDialog.previewFailed"),
          );
        } else {
          setOrgs(body.data?.orgs ?? []);
        }
      } catch {
        if (!cancelled) {
          setPreviewError(t("admin.users.deleteDialog.previewFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user.user_id, t]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetchJson(`/api/users/${user.user_id}`, { method: "DELETE" });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      // fetchJson 已 toast；仅保持弹窗打开以便重试
      if (!(e instanceof ApiError)) throw e;
    } finally {
      setDeleting(false);
    }
  };

  const displayName = user.name || displayAccount(user.email) || user.user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t("admin.users.deleteDialog.title", "删除用户")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "admin.users.deleteDialog.description",
              "确定要删除用户 {{name}} 吗？此操作不可撤销。",
              { name: displayName },
            )}
          </DialogDescription>
        </DialogHeader>

        {previewError ? (
          <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
            {previewError}
          </div>
        ) : orgs === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("admin.users.deleteDialog.loadingPreview", "正在分析影响…")}
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t(
              "admin.users.deleteDialog.noOwnedOrgs",
              "该用户不是任何组织的拥有者，删除不影响现有组织。",
            )}
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
            {orgs.map((org) => (
              <li
                key={org.id}
                className="flex items-start gap-2 rounded border px-3 py-2"
              >
                {org.action === "delete" ? (
                  <Trash2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                ) : org.action === "promote" ? (
                  <Crown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <Minus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{org.name || org.id}</div>
                  <div className="text-muted-foreground">
                    {org.action === "delete"
                      ? t(
                          "admin.users.deleteDialog.orgDelete",
                          "将被删除（{{workspaces}} 个工作空间、{{assets}} 个资产及其文件）",
                          {
                            workspaces: org.workspaceCount ?? 0,
                            assets: org.assetCount ?? 0,
                          },
                        )
                      : org.action === "promote"
                        ? t(
                            "admin.users.deleteDialog.orgPromote",
                            "{{name}} 将被晋升为拥有者",
                            {
                              name:
                                org.successor?.name ||
                                displayAccount(org.successor?.email ?? null) ||
                                "—",
                            },
                          )
                        : t(
                            "admin.users.deleteDialog.orgUnchanged",
                            "已有其他拥有者，不受影响",
                          )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            {t("common.cancel", "取消")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || orgs === null || !!previewError}
          >
            {deleting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t("common.delete", "删除")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
