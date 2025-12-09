"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadAssetDialog } from "@/components/upload-asset-dialog";

interface LocationData {
  longitude: number;
  latitude: number;
  height: number;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
}

export default function ManagePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clickedLocation, setClickedLocation] = useState<LocationData | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // 获取所有 workspace
  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const response = await fetch("/api/workspaces");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "获取工作空间失败");
        }

        setWorkspaces(result.data || []);

        // 默认选择第一个 workspace
        if (result.data && result.data.length > 0) {
          setSelectedWorkspaceId(result.data[0].id);
        }
      } catch (err) {
        console.error("获取 workspace 失败:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证消息格式
      if (
        event.data?.type === "LOCATION_CLICKED" &&
        event.data?.source === "viewer"
      ) {
        setClickedLocation(event.data.payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleUpload = (data: {
    type: string;
    file?: File;
    link?: string;
    text?: string;
    location?: LocationData;
  }) => {
    console.log("上传成功:", data);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* 左侧 iframe 容器 */}
      <div
        className="relative transition-all duration-300 ease-in-out"
        style={{
          width: sidebarOpen ? "calc(100% - 400px)" : "100%",
        }}
      >
        <iframe
          src="/js/viewer/index.html"
          className="w-full h-full border-0"
          title="3D Viewer"
        />
      </div>

      {/* 右侧侧边栏 */}
      <div
        className="relative border-l transition-all duration-300 ease-in-out overflow-hidden bg-background"
        style={{
          width: sidebarOpen ? "400px" : "0px",
        }}
      >
        {/* 侧边栏内容 */}
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">资源管理</h2>
              <p className="text-sm text-muted-foreground mt-1">
                管理您的工作空间和资源
              </p>
            </div>

            {/* Workspace 选择器 */}
            <div className="space-y-2">
              <Label htmlFor="workspace">工作空间</Label>
              <Select
                value={selectedWorkspaceId || undefined}
                onValueChange={(value) => setSelectedWorkspaceId(value)}
                disabled={loading}
              >
                <SelectTrigger id="workspace">
                  <SelectValue placeholder="选择工作空间..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWorkspaceId && (
                <p className="text-xs text-muted-foreground">
                  当前工作空间:{" "}
                  {workspaces.find((w) => w.id === selectedWorkspaceId)?.name}
                </p>
              )}
            </div>

            {/* 上传按钮 */}
            {selectedWorkspaceId && (
              <UploadAssetDialog
                workspaceId={selectedWorkspaceId}
                location={clickedLocation}
                onUpload={handleUpload}
              />
            )}
            {!selectedWorkspaceId && (
              <p className="text-sm text-muted-foreground text-center p-4 border rounded-lg">
                请先选择工作空间
              </p>
            )}

            {/* 点击位置卡片 */}
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">点击位置</h3>
                </div>
                {clickedLocation ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">经度:</span>
                      <span className="font-mono">
                        {clickedLocation.longitude.toFixed(6)}°
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">纬度:</span>
                      <span className="font-mono">
                        {clickedLocation.latitude.toFixed(6)}°
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">高度:</span>
                      <span className="font-mono">
                        {clickedLocation.height.toFixed(2)}m
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    点击地图查看坐标...
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* 切换按钮 */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-1/2 -translate-y-1/2 z-50 rounded-lg shadow-lg transition-all duration-300 ease-in-out"
        style={{
          right: sidebarOpen ? "408px" : "8px",
        }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
