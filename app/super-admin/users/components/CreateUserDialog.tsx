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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("user");
    setError("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await fetchJson("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("admin.users.createDialog.createFailed", "创建失败"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("admin.users.createDialog.title", "新增用户")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.users.createDialog.description",
                "手动注册一个新用户，邮箱将自动确认，无需验证。",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-user-email">
                {t("admin.users.createDialog.email", "邮箱")}
              </Label>
              <Input
                id="create-user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-user-password">
                {t("admin.users.createDialog.password", "密码")}
              </Label>
              <Input
                id="create-user-password"
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(
                  "admin.users.createDialog.passwordHint",
                  "至少 6 位",
                )}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-user-name">
                {t("admin.users.createDialog.name", "姓名（可选）")}
              </Label>
              <Input
                id="create-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(
                  "admin.users.createDialog.namePlaceholder",
                  "用户显示名称",
                )}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-user-role">
                {t("admin.users.createDialog.role", "角色")}
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="create-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    {t(
                      "admin.users.changeRoleDialog.userRole",
                      "普通用户 (User)",
                    )}
                  </SelectItem>
                  <SelectItem value="super_admin">
                    {t(
                      "admin.users.changeRoleDialog.superAdminRole",
                      "超级管理员 (Super Admin)",
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel", "取消")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.users.createDialog.create", "创建")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
