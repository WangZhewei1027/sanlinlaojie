"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Users as UsersIcon } from "lucide-react";
import { UserList } from "../components/UserList";
import { ChangeRoleDialog } from "../components/ChangeRoleDialog";

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

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [roleRes, usersRes] = await Promise.all([
          fetch("/api/auth/role"),
          fetch("/api/users"),
        ]);
        const [roleData, usersData] = await Promise.all([
          roleRes.json(),
          usersRes.json(),
        ]);

        if (roleData?.userId) setCurrentUserId(roleData.userId);
        if (usersData?.data) setUsers(usersData.data);
      } catch (error) {
        console.error("Init failed:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleSuccess = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.data) setUsers(data.data);
  };

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
        <>
          <ChangeRoleDialog
            open={roleDialogOpen}
            onOpenChange={setRoleDialogOpen}
            user={selectedUser}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
