"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  X,
  Users,
  ChevronsUpDown,
  Check,
  FolderKanban,
} from "lucide-react";
import { useManageStore } from "@/app/manage/store";
import { isSuperAdmin, hasOrgPermission } from "@/lib/permissions";
import { ManageWorkspaceDialog } from "./components/ManageWorkspaceDialog";

interface User {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
}

interface Member {
  id: string;
  role: string;
  created_at: string;
  user_id: string;
  users: User;
}

export default function MembersPage() {
  const { t } = useTranslation();
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const currentUserRole = useManageStore((state) => state.currentUserRole);

  const orgRole = selectedOrganization?.role ?? null;
  const canAdd =
    isSuperAdmin(currentUserRole) ||
    hasOrgPermission(orgRole, "org.members.add");
  const canRemove =
    isSuperAdmin(currentUserRole) ||
    hasOrgPermission(orgRole, "org.members.remove");
  const canChangeRole =
    isSuperAdmin(currentUserRole) ||
    hasOrgPermission(orgRole, "org.members.changeRole");
  const canManageOwners =
    isSuperAdmin(currentUserRole) ||
    hasOrgPermission(orgRole, "org.members.manageOwners");

  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceDialogMember, setWorkspaceDialogMember] =
    useState<Member | null>(null);
  const [removeMember, setRemoveMember] = useState<Member | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!selectedOrganization?.id) return;

    setFetchLoading(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        fetch(`/api/organizations/${selectedOrganization.id}/members`),
        fetch("/api/users"),
      ]);

      const membersData = await membersRes.json();
      const usersData = await usersRes.json();

      setMembers(membersData.data || []);
      setAllUsers(usersData.data || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrganization?.id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganization?.id]);

  const handleAdd = async () => {
    if (!selectedUserId || !selectedOrganization?.id) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `/api/organizations/${selectedOrganization.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            role: selectedRole,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to add member");

      setSelectedUserId("");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!selectedOrganization?.id) return;

    try {
      const response = await fetch(
        `/api/organizations/${selectedOrganization.id}/members?member_id=${memberId}`,
        { method: "DELETE" },
      );

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to remove member");

      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!selectedOrganization?.id) return;

    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${selectedOrganization.id}/members`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: memberId, role: newRole }),
        },
      );

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Failed to update role");

      // Update locally without full refetch
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.user_id === u.user_id),
  );

  const getUserLabel = (user: User) => {
    return user.name || user.email || user.user_id.slice(0, 8);
  };

  const filteredUsers = availableUsers.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.user_id.toLowerCase().includes(q)
    );
  });

  const selectedUserObj = allUsers.find((u) => u.user_id === selectedUserId);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const roleColors: Record<string, string> = {
    owner:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    member: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
  };

  if (!selectedOrganization) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t(
            "admin.members.selectOrgFirst",
            "Please select an organization first",
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-7 w-7" />
          <h1 className="text-2xl font-bold">
            {t("admin.members.title", "Members")}
          </h1>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <p className="text-muted-foreground">
          {t("admin.members.description", "Manage members of {{name}}", {
            name: selectedOrganization.name,
          })}
        </p>
      </div>

      {fetchLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add member form */}
          {canAdd && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-medium mb-3 block">
                {t("admin.members.addMember", "Add Member")}
              </Label>
              <div className="flex gap-2 flex-wrap">
                <div
                  className="relative flex-1 min-w-[200px]"
                  ref={dropdownRef}
                >
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span
                      className={selectedUserObj ? "" : "text-muted-foreground"}
                    >
                      {selectedUserObj
                        ? getUserLabel(selectedUserObj)
                        : t("admin.members.selectUser", "Select user...")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                      <div className="p-2">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t("common.search", "Search...")}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {availableUsers.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            {t(
                              "admin.members.noAvailableUsers",
                              "No available users to add",
                            )}
                          </p>
                        ) : filteredUsers.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            {t("common.noResults", "No results")}
                          </p>
                        ) : (
                          filteredUsers.map((user) => (
                            <button
                              key={user.user_id}
                              type="button"
                              onClick={() => {
                                setSelectedUserId(user.user_id);
                                setDropdownOpen(false);
                                setSearchQuery("");
                              }}
                              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            >
                              {selectedUserId === user.user_id ? (
                                <Check className="mr-2 h-4 w-4" />
                              ) : (
                                <span className="mr-2 w-4" />
                              )}
                              <span className="truncate">
                                {getUserLabel(user)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">
                      {t("admin.organization.roles.member", "Member")}
                    </SelectItem>
                    <SelectItem value="admin">
                      {t("admin.organization.roles.admin", "Admin")}
                    </SelectItem>
                    {canManageOwners && (
                      <SelectItem value="owner">
                        {t("admin.organization.roles.owner", "Owner")}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedUserId || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {t("common.create", "Add")}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Member list */}
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("admin.members.noMembers", "No members yet")}
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {(
                        member.users?.name?.[0] ||
                        member.users?.email?.[0] ||
                        "?"
                      ).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.users?.name ||
                          member.users?.email ||
                          t("admin.members.unnamed", "Unnamed user")}
                      </p>
                      {member.users?.email && member.users?.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.users.email}
                        </p>
                      )}
                    </div>
                    {canChangeRole &&
                    (member.role !== "owner" || canManageOwners) ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value)
                        }
                      >
                        <SelectTrigger
                          className={`w-[110px] h-8 text-xs border-0 ${roleColors[member.role] || ""}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">
                            {t("admin.organization.roles.member", "Member")}
                          </SelectItem>
                          <SelectItem value="admin">
                            {t("admin.organization.roles.admin", "Admin")}
                          </SelectItem>
                          {canManageOwners && (
                            <SelectItem value="owner">
                              {t("admin.organization.roles.owner", "Owner")}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        className={`text-xs ${roleColors[member.role] || ""}`}
                      >
                        {t(
                          `admin.organization.roles.${member.role}`,
                          member.role,
                        )}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setWorkspaceDialogMember(member);
                        setWorkspaceDialogOpen(true);
                      }}
                      title={t(
                        "admin.members.assignWorkspace",
                        "Assign Workspace",
                      )}
                    >
                      <FolderKanban className="h-4 w-4" />
                    </Button>
                    {canRemove &&
                      (member.role !== "owner" || canManageOwners) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRemoveMember(member)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {t("admin.members.removeDialog.title", "Remove Member")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.members.removeDialog.description",
                "Are you sure you want to remove {{name}} from this organization?",
                {
                  name:
                    removeMember?.users?.name ||
                    removeMember?.users?.email ||
                    t("admin.members.unnamed", "Unnamed user"),
                },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRemoveMember(null)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removeMember) {
                  handleRemove(removeMember.id);
                  setRemoveMember(null);
                }
              }}
            >
              {t("admin.members.removeDialog.confirm", "Remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Dialog */}
      {workspaceDialogMember && (
        <ManageWorkspaceDialog
          open={workspaceDialogOpen}
          onOpenChange={setWorkspaceDialogOpen}
          organizationId={selectedOrganization.id}
          user={{
            user_id: workspaceDialogMember.user_id,
            name:
              workspaceDialogMember.users?.name ||
              workspaceDialogMember.users?.email ||
              null,
          }}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  );
}
