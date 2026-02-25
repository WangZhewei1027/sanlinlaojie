"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CleanLog } from "./components/CleanLog";

type CleanAction = "clean-rows" | "clean-files" | "both";

interface CleanResult {
  orphanedRows: {
    id: string;
    file_url: string;
    reason: string;
  }[];
  orphanedFiles: {
    path: string;
    name: string;
  }[];
  deletedRows: string[];
  deletedFiles: string[];
  errors: string[];
}

interface CleanSummary {
  orphanedRowsFound: number;
  orphanedFilesFound: number;
  rowsDeleted: number;
  filesDeleted: number;
  errorsCount: number;
}

export default function CleanPage() {
  const { t } = useTranslation();
  const { workspaces, selectedWorkspaceId, setSelectedWorkspaceId, loading } =
    useWorkspace();
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [summary, setSummary] = useState<CleanSummary | null>(null);

  const handleClean = async (action: CleanAction) => {
    if (!selectedWorkspaceId) {
      alert(t("admin.clean.selectWorkspaceFirst"));
      return;
    }

    if (
      !confirm(
        t("admin.clean.confirmMessage") +
          "\n\n" +
          `${
            action === "clean-rows"
              ? t("admin.clean.willDeleteRows") + "\n"
              : ""
          }` +
          `${
            action === "clean-files"
              ? t("admin.clean.willDeleteFiles") + "\n"
              : ""
          }` +
          `${
            action === "both"
              ? t("admin.clean.willDeleteRows") +
                "\n" +
                t("admin.clean.willDeleteFiles") +
                "\n"
              : ""
          }` +
          "\n" +
          t("admin.clean.irreversible"),
      )
    ) {
      return;
    }

    setCleaning(true);
    setResult(null);
    setSummary(null);

    try {
      const response = await fetch("/api/admin/clean", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "清理失败");
      }

      setResult(data.data);
      setSummary(data.summary);
    } catch (error) {
      console.error("清理失败:", error);
      alert(
        error instanceof Error ? error.message : t("admin.clean.cleanFailed"),
      );
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trash2 className="h-7 w-7" />
          <h1 className="text-2xl font-bold">{t("admin.clean.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("admin.clean.description")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>清理操作</CardTitle>
              <CardDescription>选择工作空间和清理类型</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 工作空间选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">工作空间</label>
                <Select
                  value={selectedWorkspaceId || ""}
                  onValueChange={setSelectedWorkspaceId}
                  disabled={cleaning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工作空间" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 清理按钮 */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!selectedWorkspaceId || cleaning}
                  onClick={() => handleClean("clean-rows")}
                >
                  {cleaning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  清理孤立数据库记录
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!selectedWorkspaceId || cleaning}
                  onClick={() => handleClean("clean-files")}
                >
                  {cleaning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  清理孤立存储文件
                </Button>

                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={!selectedWorkspaceId || cleaning}
                  onClick={() => handleClean("both")}
                >
                  {cleaning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  全面清理
                </Button>
              </div>

              {/* 说明 */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-medium mb-1">注意事项：</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>清理操作不可逆，请谨慎操作</li>
                      <li>孤立记录：数据库中存在但文件已被删除</li>
                      <li>孤立文件：存储桶中存在但数据库无记录</li>
                      <li>建议先单独清理，确认无误后再全面清理</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {summary && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>清理摘要</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {summary.orphanedRowsFound}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      孤立记录
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.orphanedFilesFound}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      孤立文件
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.rowsDeleted}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      已删记录
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.filesDeleted}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      已删文件
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {summary.errorsCount}
                    </div>
                    <div className="text-sm text-muted-foreground">错误</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {result && <CleanLog result={result} />}

          {!result && !cleaning && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trash2 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  选择工作空间和清理类型开始清理
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
