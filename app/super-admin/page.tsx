"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSuperAdmin } from "@/lib/permissions";
import { UserList } from "./components/UserList";
import { ChangeRoleDialog } from "./components/ChangeRoleDialog";
import { ManageWorkspaceDialog } from "./components/ManageWorkspaceDialog";

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

export default function SuperAdminPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const roleRes = await fetch("/api/auth/role");
        const roleData = await roleRes.json();

        if (!isSuperAdmin(roleData?.role)) {
          router.replace("/403");
          return;
        }

        setAuthorized(true);
        setCurrentUserId(roleData.userId);

        const usersRes = await fetch("/api/users");
        const usersData = await usersRes.json();
        if (usersData.data) {
          setUsers(usersData.data);
        }
      } catch (error) {
        console.error("Init failed:", error);
        router.replace("/403");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleManageWorkspace = (user: UserData) => {
    setSelectedUser(user);
    setWorkspaceDialogOpen(true);
  };

  const handleSuccess = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.data) setUsers(data.data);
  };

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("common.back", "返回")}
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-7 w-7" />
                <h1 className="text-2xl font-bold">
                  {t("home.quickLinks.superAdmin.title")}
                </h1>
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
          onManageWorkspace={handleManageWorkspace}
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
            <ManageWorkspaceDialog
              open={workspaceDialogOpen}
              onOpenChange={setWorkspaceDialogOpen}
              user={selectedUser}
              onSuccess={handleSuccess}
            />
          </>
        )}
      </div>
    </div>
  );
}
