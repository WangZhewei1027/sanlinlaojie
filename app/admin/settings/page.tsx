"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useManageStore } from "@/app/manage/store";
import { isSuperAdmin, hasOrgPermission } from "@/lib/permissions";
import { fetchJson } from "@/lib/fetch-json";
import { OrgSettingsForm } from "@/components/org-settings/OrgSettingsForm";
import type {
  OrgSettingsPayload,
  OrgSettingsSource,
} from "@/components/org-settings/types";

export default function SettingsPage() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const setSelectedOrganization = useManageStore(
    (state) => state.setSelectedOrganization,
  );
  const currentUserRole = useManageStore((state) => state.currentUserRole);

  const orgRole = selectedOrganization?.role ?? null;
  const superAdmin = isSuperAdmin(currentUserRole);
  const canEditSettings =
    superAdmin || hasOrgPermission(orgRole, "org.settings");
  const canDeleteOrg = superAdmin || hasOrgPermission(orgRole, "org.delete");

  const orgId = selectedOrganization?.id;

  // 表单需要完整组织行（map_center / allowed_file_types / config），
  // store 里的 selectedOrganization 不含这些字段，进页面时拉一次
  const [org, setOrg] = useState<OrgSettingsSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${orgId}`);
        const body = await res.json();
        if (!cancelled) setOrg(res.ok ? (body.data ?? null) : null);
      } catch {
        if (!cancelled) setOrg(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const save = useCallback(
    async (payload: OrgSettingsPayload): Promise<{ error?: string }> => {
      try {
        const { data } = await fetchJson<{ data: OrgSettingsSource }>(
          `/api/organizations/${orgId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        // 刷新本地表单基线 + store（导航栏组织名等）
        setOrg(data);
        if (selectedOrganization) {
          setSelectedOrganization({
            ...selectedOrganization,
            name: payload.name,
            description: payload.description,
            map_center: payload.map_center,
            allowed_file_types: payload.allowed_file_types,
          });
        }
        return {};
      } catch (e) {
        // fetchJson 已弹 toast；返回错误让表单也显示
        return { error: e instanceof Error ? e.message : "保存失败" };
      }
    },
    [orgId, selectedOrganization, setSelectedOrganization],
  );

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

  // 页面级 guard：只有 owner / super_admin 能管理组织设置或删除组织
  if (!canEditSettings && !canDeleteOrg) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <ShieldAlert className="h-10 w-10" />
          <p>{t("admin.settings.noPermission", "你没有权限管理此组织设置")}</p>
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

      {/* Org settings（与 super-admin 组织详情面板共用的表单） */}
      <div className="border rounded-lg p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : org && canEditSettings ? (
          <OrgSettingsForm
            org={org}
            save={save}
            onSuccess={() =>
              toast.success(t("admin.settings.saved", "设置已保存"))
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("admin.settings.loadFailed", "加载组织信息失败，请刷新重试")}
          </p>
        )}
      </div>

      {/* Danger zone */}
      {canDeleteOrg && (
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
      )}
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetchJson(`/api/organizations/${orgId}`, { method: "DELETE" });
      // Reload after deletion
      window.location.href = "/admin";
    } catch {
      // fetchJson 已弹 toast
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
