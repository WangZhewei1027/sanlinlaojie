"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Crown, X, ChevronsUpDown, Check } from "lucide-react";

interface MemberData {
  id: string;
  role: string;
  user_id: string;
  users: {
    user_id: string;
    name: string | null;
    email: string | null;
  };
}

interface OrgData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
  organization_member: MemberData[];
}

interface SetOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: OrgData;
  onSuccess: () => void;
}

export function SetOwnerDialog({
  open,
  onOpenChange,
  org,
  onSuccess,
}: SetOwnerDialogProps) {
  const { t } = useTranslation();
  const [allUsers, setAllUsers] = useState<
    Array<{ user_id: string; name: string | null; email: string | null }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const members = org.organization_member || [];
  const owners = members.filter((m) => m.role === "owner");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSelectedUserId("");
    setSearchQuery("");
    setDropdownOpen(false);
    setFetchLoading(true);

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setAllUsers(data.data);
      })
      .catch(() => {})
      .finally(() => setFetchLoading(false));
  }, [open]);

  const handleSetOwner = async () => {
    if (!selectedUserId) return;
    setError("");
    setLoading(true);

    try {
      // Check if user is already a member
      const existingMember = members.find((m) => m.user_id === selectedUserId);

      if (existingMember) {
        // Update existing member to owner
        const res = await fetch(`/api/organizations/${org.id}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: existingMember.id,
            role: "owner",
          }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(
            result.error || t("common.updateFailed", "Update failed"),
          );
      } else {
        // Add user as owner
        const res = await fetch(`/api/organizations/${org.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedUserId,
            role: "owner",
          }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(
            result.error || t("common.updateFailed", "Update failed"),
          );
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.updateFailed", "Update failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveOwner = async (memberId: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/organizations/${org.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          role: "member",
        }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.error || t("common.updateFailed", "Update failed"),
        );

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.updateFailed", "Update failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  // Users not currently owner of this org
  const availableUsers = allUsers.filter(
    (u) => !owners.some((o) => o.user_id === u.user_id),
  );

  const getUserLabel = (user: {
    user_id: string;
    name: string | null;
    email: string | null;
  }) => {
    const main = user.name || user.email || user.user_id;
    const extra = user.email && user.name ? ` (${user.email})` : "";
    return main + extra;
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

  const selectedUser = allUsers.find((u) => u.user_id === selectedUserId);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t(
              "superAdmin.orgs.setOwnerDialog.title",
              "Set Organization Owner",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              "superAdmin.orgs.setOwnerDialog.description",
              "Manage owners for {{name}}",
              { name: org.name },
            )}
          </DialogDescription>
        </DialogHeader>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current owners */}
            <div className="space-y-2">
              <Label>
                {t("superAdmin.orgs.currentOwners", "Current Owners")}
              </Label>
              {owners.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("superAdmin.orgs.noOwner", "No owner")}
                </p>
              ) : (
                <div className="space-y-2">
                  {owners.map((owner) => (
                    <div
                      key={owner.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">
                          {owner.users?.name ||
                            owner.users?.email ||
                            owner.user_id}
                        </span>
                        {owner.users?.email && owner.users?.name && (
                          <span className="text-xs text-muted-foreground">
                            {owner.users.email}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOwner(owner.id)}
                        disabled={loading}
                        title={t(
                          "superAdmin.orgs.demoteToMember",
                          "Demote to member",
                        )}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new owner */}
            <div className="space-y-2">
              <Label>{t("superAdmin.orgs.addOwner", "Add Owner")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={selectedUser ? "" : "text-muted-foreground"}
                    >
                      {selectedUser
                        ? getUserLabel(selectedUser)
                        : t("superAdmin.orgs.selectUser", "Select user")}
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
                        {filteredUsers.length === 0 ? (
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
                              {selectedUserId === user.user_id && (
                                <Check className="mr-2 h-4 w-4" />
                              )}
                              {selectedUserId !== user.user_id && (
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
                <Button
                  onClick={handleSetOwner}
                  disabled={!selectedUserId || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("common.add", "Add")
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "superAdmin.orgs.setOwnerHint",
                  "If the user is not a member, they will be added as owner. If already a member, their role will be changed to owner.",
                )}
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.close", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
