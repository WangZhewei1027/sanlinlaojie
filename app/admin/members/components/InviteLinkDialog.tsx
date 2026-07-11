"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Copy, Check, Link2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
}

const NO_WORKSPACE = "__none__";

export function InviteLinkDialog({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState("member");
  const [workspaceId, setWorkspaceId] = useState(NO_WORKSPACE);
  const [expiry, setExpiry] = useState("7"); // 天数；"never" = 永不过期
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setCopied(false);
      setRole("member");
      setWorkspaceId(NO_WORKSPACE);
      setExpiry("7");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/workspaces?organization_id=${organizationId}`,
        );
        const json = await res.json();
        if (res.ok) setWorkspaces(json.data || []);
      } catch {
        // 非致命：无 workspace 列表时仅能生成「仅加入组织」链接
      }
    })();
  }, [open, organizationId]);

  // 参数一改，已生成的链接就作废（避免链接与当前设置不一致的困惑）
  const resetUrl = () => {
    setUrl("");
    setCopied(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const json = await fetchJson<{ data: { token: string; url?: string } }>(
        `/api/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            workspace_id: workspaceId === NO_WORKSPACE ? null : workspaceId,
            expires_at:
              expiry === "never"
                ? null
                : new Date(
                    Date.now() + Number(expiry) * 24 * 60 * 60 * 1000,
                  ).toISOString(),
          }),
        },
      );
      // 用浏览器自身 origin 拼链接（地址栏那个才是可分享的），
      // 不依赖服务端 request.url —— 后者在代理/非默认端口下会给出内部地址。
      setUrl(`${window.location.origin}/invite/${json.data.token}`);
    } catch {
      // fetchJson 已弹 toast
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("admin.members.invite.copied", "链接已复制"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("common.copyFailed", "复制失败"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("admin.members.invite.title", "生成邀请链接")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "admin.members.invite.description",
              "分享链接，对方登录后自动加入本组织。",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.members.invite.role", "角色")}</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v);
                resetUrl();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  {t("admin.organization.roles.viewer", "Viewer")}
                </SelectItem>
                <SelectItem value="member">
                  {t("admin.organization.roles.member", "Member")}
                </SelectItem>
                <SelectItem value="admin">
                  {t("admin.organization.roles.admin", "Admin")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {t("admin.members.invite.workspace", "工作区（可选）")}
            </Label>
            <Select
              value={workspaceId}
              onValueChange={(v) => {
                setWorkspaceId(v);
                resetUrl();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_WORKSPACE}>
                  {t("admin.members.invite.noWorkspace", "仅加入组织")}
                </SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("admin.members.invite.expiry", "有效期")}</Label>
            <Select
              value={expiry}
              onValueChange={(v) => {
                setExpiry(v);
                resetUrl();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  {t("admin.members.invite.expiry1d", "1 天")}
                </SelectItem>
                <SelectItem value="7">
                  {t("admin.members.invite.expiry7d", "7 天")}
                </SelectItem>
                <SelectItem value="30">
                  {t("admin.members.invite.expiry30d", "30 天")}
                </SelectItem>
                <SelectItem value="never">
                  {t("admin.members.invite.expiryNever", "永不过期")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {url ? (
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {t("admin.members.invite.generate", "生成链接")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
