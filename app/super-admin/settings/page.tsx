"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileTypesSection } from "@/components/org-settings/FileTypesSection";
import { fetchJson } from "@/lib/fetch-json";
import { DEFAULT_UPLOAD_TYPES } from "@/lib/upload/types";

// super-admin 系统设置：目前只有"新组织默认文件类型"。
// 该集合在建组织时写入 organization.allowed_file_types（注册触发器 + 建组织 API），
// 改动只影响之后新建的组织，已有组织在各自设置里单独调。
export default function SuperAdminSettingsPage() {
  const { t } = useTranslation();
  const [fileTypes, setFileTypes] = useState<Set<string> | null>(null);
  const [baseline, setBaseline] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/app-config");
        const body = await res.json();
        if (cancelled) return;
        const value = res.ok ? body.data?.default_allowed_file_types : null;
        const types = Array.isArray(value) ? value : DEFAULT_UPLOAD_TYPES;
        setBaseline(types);
        setFileTypes(new Set(types));
      } catch {
        if (!cancelled) {
          setBaseline(DEFAULT_UPLOAD_TYPES);
          setFileTypes(new Set(DEFAULT_UPLOAD_TYPES));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFileType = (type: string) => {
    setFileTypes((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const hasChanged =
    fileTypes !== null &&
    (fileTypes.size !== baseline.length ||
      !baseline.every((t) => fileTypes.has(t)));

  const handleSave = async () => {
    if (!fileTypes) return;
    setSaving(true);
    try {
      const value = [...fileTypes];
      await fetchJson("/api/admin/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "default_allowed_file_types", value }),
      });
      setBaseline(value);
      toast.success(t("superAdmin.settings.saved", "设置已保存"));
    } catch {
      // fetchJson 已弹 toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-7 w-7" />
          <h1 className="text-2xl font-bold">
            {t("superAdmin.settings.title", "系统设置")}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {t("superAdmin.settings.description", "全局默认配置")}
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold">
            {t("superAdmin.settings.defaultFileTypes", "新组织默认文件类型")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "superAdmin.settings.defaultFileTypesDesc",
              "新建组织（含注册时自动创建的个人组织）默认允许上传的文件类型；不影响已有组织。",
            )}
          </p>
        </div>

        {fileTypes === null ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <FileTypesSection
              fileTypes={fileTypes}
              toggleFileType={toggleFileType}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!hasChanged || saving}
                size="sm"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-2" />
                )}
                {t("common.save", "保存")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
