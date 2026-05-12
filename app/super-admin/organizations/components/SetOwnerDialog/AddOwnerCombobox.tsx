"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SimpleUser {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface AddOwnerComboboxProps {
  availableUsers: SimpleUser[];
  loading: boolean;
  onAdd: (userId: string) => void;
}

const getUserLabel = (user: SimpleUser) => {
  const main = user.name || user.email || user.user_id;
  const extra = user.email && user.name ? ` (${user.email})` : "";
  return main + extra;
};

export function AddOwnerCombobox({
  availableUsers,
  loading,
  onAdd,
}: AddOwnerComboboxProps) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = availableUsers.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.user_id.toLowerCase().includes(q)
    );
  });

  const selectedUser = availableUsers.find((u) => u.user_id === selectedUserId);

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
    <div className="space-y-2">
      <Label>{t("superAdmin.orgs.addOwner", "Add Owner")}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={selectedUser ? "" : "text-muted-foreground"}>
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
                      {selectedUserId === user.user_id ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <span className="mr-2 w-4" />
                      )}
                      <span className="truncate">{getUserLabel(user)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={() => onAdd(selectedUserId)}
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
  );
}
