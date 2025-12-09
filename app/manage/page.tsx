"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ManagePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                侧边栏内容待开发...
              </p>
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
