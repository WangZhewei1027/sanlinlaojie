"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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

export default function UsersManagePage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const result = await response.json();
      if (result.data) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error("获取用户列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/role");
      const result = await response.json();
      if (result.userId) {
        setCurrentUserId(result.userId);
      }
    } catch (error) {
      console.error("获取当前用户失败:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const handleChangeRole = (user: UserData) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleManageWorkspace = (user: UserData) => {
    setSelectedUser(user);
    setWorkspaceDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回管理后台
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UsersIcon className="h-8 w-8" />
              <h1 className="text-3xl font-bold">用户管理</h1>
            </div>
            <p className="text-muted-foreground">
              管理用户角色和工作空间访问权限
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-sm text-muted-foreground">总用户数</p>
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
  );
}
