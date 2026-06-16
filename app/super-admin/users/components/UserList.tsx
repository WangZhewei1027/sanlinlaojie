"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, UserCog, User, Layers } from "lucide-react";
import type { UserData } from "../types";

interface UserListProps {
  users: UserData[];
  currentUserId: string;
  onChangeRole: (user: UserData) => void;
}

function initials(name: string | null, email: string | null) {
  const src = (name || email || "?").trim();
  return src.slice(0, 2).toUpperCase();
}

// Compact, locale-aware relative time, e.g. "3 天前" / "3 days ago".
function relativeTime(iso: string | null | undefined, locale?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "minute");
}

export function UserList({ users, currentUserId, onChangeRole }: UserListProps) {
  const { t, i18n } = useTranslation();

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed py-16">
        <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="text-sm font-medium">
          {t("admin.users.noUsers", "暂无用户")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t("admin.users.noUsersHint", "等待用户注册")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="text-left font-medium px-4 py-2.5">
                {t("admin.users.columns.user", "用户")}
              </th>
              <th className="text-left font-medium px-3 py-2.5">
                {t("admin.users.columns.role", "角色")}
              </th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">
                {t("admin.users.columns.workspaces", "工作空间")}
              </th>
              <th className="text-left font-medium px-3 py-2.5 hidden lg:table-cell">
                {t("admin.users.columns.lastSignIn", "最近登录")}
              </th>
              <th className="text-left font-medium px-3 py-2.5 hidden xl:table-cell">
                {t("admin.users.columns.registered", "注册时间")}
              </th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isCurrentUser = user.user_id === currentUserId;
              const workspaces = (user.workspace_assignment ?? [])
                .map((a) => a.workspace?.name)
                .filter(Boolean) as string[];

              return (
                <tr
                  key={user.user_id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* User */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {initials(user.name, user.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">
                            {user.name ||
                              t("admin.users.unnamed", "未命名用户")}
                          </span>
                          {isCurrentUser && (
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[10px] leading-4"
                            >
                              {t("admin.users.currentUser", "当前")}
                            </Badge>
                          )}
                        </div>
                        <span className="block text-xs text-muted-foreground truncate">
                          {user.email || "—"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={
                        user.role === "super_admin" ? "default" : "secondary"
                      }
                      className="font-normal"
                    >
                      {t(`admin.users.roles.${user.role}`, user.role)}
                    </Badge>
                  </td>

                  {/* Workspaces */}
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    {workspaces.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        title={workspaces.join("、")}
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {workspaces.length <= 2
                            ? workspaces.join("、")
                            : t(
                                "admin.users.workspaceCount",
                                "{{count}} 个工作空间",
                                { count: workspaces.length },
                              )}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Last sign-in */}
                  <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {user.last_sign_in_at ? (
                      <span
                        title={new Date(user.last_sign_in_at).toLocaleString()}
                      >
                        {relativeTime(user.last_sign_in_at, i18n.language)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">
                        {t("admin.users.neverSignedIn", "从未登录")}
                      </span>
                    )}
                  </td>

                  {/* Registered */}
                  <td className="px-3 py-2.5 hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onChangeRole(user)}
                          disabled={isCurrentUser}
                        >
                          <UserCog className="h-4 w-4 mr-2" />
                          {t("admin.users.changeRole", "修改角色")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
