"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCog, User, Calendar, Mail } from "lucide-react";

interface UserData {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

interface UserListProps {
  users: UserData[];
  currentUserId: string;
  onChangeRole: (user: UserData) => void;
}

export function UserList({
  users,
  currentUserId,
  onChangeRole,
}: UserListProps) {
  const { t } = useTranslation();

  if (users.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <User className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t("admin.users.noUsers", "暂无用户")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("admin.users.noUsersHint", "等待用户注册")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {users.map((user) => {
        const isCurrentUser = user.user_id === currentUserId;

        return (
          <Card key={user.user_id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg truncate">
                    {user.name || t("admin.users.unnamed", "未命名用户")}
                  </h3>
                  <Badge
                    variant={
                      user.role === "super_admin" ? "default" : "secondary"
                    }
                  >
                    {t(`admin.users.roles.${user.role}`, user.role)}
                  </Badge>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs">
                      {t("admin.users.currentUser", "当前用户")}
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
                      {t("admin.users.registeredOn", "注册于")}{" "}
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

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
                  {t("admin.users.changeRole", "修改角色")}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
