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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ChangeRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    name: string | null;
    role: string;
  };
  onSuccess: () => void;
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ChangeRoleDialogProps) {
  const { t } = useTranslation();
  const [role, setRole] = useState<string>(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.user_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("common.updateFailed", "更新失败"));
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.updateFailed", "更新失败"));
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
              {t("admin.users.changeRoleDialog.title", "修改用户角色")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.users.changeRoleDialog.description", "修改 {{name}} 的角色权限", {
                name: user.name || t("admin.users.unnamed", "未命名用户"),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">
                {t("admin.users.changeRoleDialog.role", "角色")}
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder={t("admin.users.changeRoleDialog.selectRole", "选择角色")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    {t("admin.users.changeRoleDialog.userRole", "普通用户 (User)")}
                  </SelectItem>
                  <SelectItem value="super_admin">
                    {t("admin.users.changeRoleDialog.superAdminRole", "超级管理员 (Super Admin)")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "super_admin"
                  ? t("admin.users.changeRoleDialog.superAdminHint", "超级管理员可以管理所有组织和用户")
                  : t("admin.users.changeRoleDialog.userHint", "普通用户通过组织角色控制权限")}
              </p>
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
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel", "取消")}
            </Button>
            <Button type="submit" disabled={loading || role === user.role}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save", "保存")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
