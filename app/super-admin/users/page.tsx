"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Users as UsersIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserList } from "./components/UserList";
import { ChangeRoleDialog } from "./components/ChangeRoleDialog";
import { useUsers } from "./hooks/useUsers";
import type { UserData } from "./types";

export default function UsersPage() {
  const { t } = useTranslation();
  const { users, currentUserId, loading, refetch } = useUsers();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <UsersIcon className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-bold leading-tight">
              {t("admin.users.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("admin.users.description")}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xl font-bold tabular-nums">{users.length}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">
            {t("admin.users.totalUsers")}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.users.searchPlaceholder", "搜索姓名或邮箱")}
            className="pl-8 h-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("admin.users.filterAll", "全部角色")}
            </SelectItem>
            <SelectItem value="super_admin">
              {t("admin.users.roles.super_admin", "超级管理员")}
            </SelectItem>
            <SelectItem value="user">
              {t("admin.users.roles.user", "普通用户")}
            </SelectItem>
          </SelectContent>
        </Select>
        {filtered.length !== users.length && (
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {t("admin.users.matchCount", "{{count}} 条结果", {
              count: filtered.length,
            })}
          </span>
        )}
      </div>

      {/* User List */}
      <UserList
        users={filtered}
        currentUserId={currentUserId}
        onChangeRole={handleChangeRole}
      />

      {/* Dialogs */}
      {selectedUser && (
        <ChangeRoleDialog
          open={roleDialogOpen}
          onOpenChange={setRoleDialogOpen}
          user={selectedUser}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
