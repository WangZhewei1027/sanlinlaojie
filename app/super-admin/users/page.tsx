"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Users as UsersIcon } from "lucide-react";
import { UserList } from "./components/UserList";
import { ChangeRoleDialog } from "./components/ChangeRoleDialog";
import { useUsers } from "./hooks/useUsers";
import type { UserData } from "./types";

export default function UsersPage() {
  const { t } = useTranslation();
  const { users, currentUserId, loading, refetch } = useUsers();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleSuccess = refetch;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UsersIcon className="h-7 w-7" />
              <h1 className="text-2xl font-bold">{t("admin.users.title")}</h1>
            </div>
            <p className="text-muted-foreground">
              {t("admin.users.description")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-sm text-muted-foreground">
              {t("admin.users.totalUsers")}
            </p>
          </div>
        </div>
      </div>

      {/* User List */}
      <UserList
        users={users}
        currentUserId={currentUserId}
        onChangeRole={handleChangeRole}
      />

      {/* Dialogs */}
      {selectedUser && (
        <ChangeRoleDialog
          open={roleDialogOpen}
          onOpenChange={setRoleDialogOpen}
          user={selectedUser}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
