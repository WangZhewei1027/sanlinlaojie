"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, FolderOpen, Calendar } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  create_date: string | null;
}

interface WorkspaceListProps {
  workspaces: Workspace[];
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}

export function WorkspaceList({
  workspaces,
  onEdit,
  onDelete,
}: WorkspaceListProps) {
  if (workspaces.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无工作空间</h3>
          <p className="text-sm text-muted-foreground">
            点击上方按钮创建第一个工作空间
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workspaces.map((workspace) => (
        <Card
          key={workspace.id}
          className="p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg mb-1 truncate">
                  {workspace.name}
                </h3>
                {workspace.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {workspace.description}
                  </p>
                )}
              </div>
            </div>

            {workspace.create_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Calendar className="h-3 w-3" />
                <span>
                  创建于{" "}
                  {new Date(workspace.create_date).toLocaleDateString("zh-CN")}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-auto pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(workspace)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(workspace)}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            </div>

            <div className="mt-3">
              <Badge variant="secondary" className="text-xs font-mono">
                ID: {workspace.id.slice(0, 8)}...
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
