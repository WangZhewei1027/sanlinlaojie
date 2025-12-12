"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCog, FolderKanban, User, Calendar, Mail } from "lucide-react";

interface UserData {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  workspace_assignment?: Array<{
    id: string;
    workspace_id: string;
    workspace: {
      id: string;
      name: string;
    };
  }>;
}

interface UserListProps {
  users: UserData[];
  currentUserId: string;
  onChangeRole: (user: UserData) => void;
  onManageWorkspace: (user: UserData) => void;
}

export function UserList({
  users,
  currentUserId,
  onChangeRole,
  onManageWorkspace,
}: UserListProps) {
  if (users.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <User className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无用户</h3>
          <p className="text-sm text-muted-foreground">等待用户注册</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {users.map((user) => {
        const isCurrentUser = user.user_id === currentUserId;
        const workspaceCount = user.workspace_assignment?.length || 0;

        return (
          <Card key={user.user_id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg truncate">
                    {user.name || "未命名用户"}
                  </h3>
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                  >
                    {user.role === "admin" ? "管理员" : "学生"}
                  </Badge>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs">
                      当前用户
                    </Badge>
                  )}
                </div>

                {user.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{user.email}</span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      注册于{" "}
                      {new Date(user.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FolderKanban className="h-3 w-3" />
                    <span>{workspaceCount} 个工作空间</span>
                  </div>
                </div>

                {/* 显示已分配的 workspaces */}
                {workspaceCount > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {user.workspace_assignment?.map((assignment) => (
                      <Badge key={assignment.id} variant="outline">
                        {assignment.workspace.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-xs text-muted-foreground/75 font-mono truncate">
                    ID: {user.user_id}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChangeRole(user)}
                  disabled={isCurrentUser}
                >
                  <UserCog className="h-4 w-4 mr-1" />
                  修改角色
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageWorkspace(user)}
                >
                  <FolderKanban className="h-4 w-4 mr-1" />
                  分配工作空间
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
