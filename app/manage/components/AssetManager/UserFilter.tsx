"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, X } from "lucide-react";
import type { Creator } from "../../types";

interface UserFilterProps {
  creators: Creator[];
  selectedUserIds: string[];
  onUsersChange: (userIds: string[]) => void;
}

export function UserFilter({
  creators,
  selectedUserIds,
  onUsersChange,
}: UserFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUsersChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onUsersChange([...selectedUserIds, userId]);
    }
  };

  const handleClearAll = () => {
    onUsersChange([]);
  };

  const hasFilters = selectedUserIds.length > 0;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={hasFilters ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1"
          >
            <User className="h-3.5 w-3.5" />
            {t("assetManager.userFilter.title")}
            {hasFilters && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 h-4 min-w-4">
                {selectedUserIds.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <span className="text-sm font-medium">
                {t("assetManager.userFilter.selectUsers")}
              </span>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t("assetManager.userFilter.clear")}
                </Button>
              )}
            </div>

            {creators.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                {t("assetManager.userFilter.noCreators")}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {creators.map((creator) => (
                  <div
                    key={creator.user_id}
                    className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => handleToggleUser(creator.user_id)}
                  >
                    <Checkbox
                      id={`user-${creator.user_id}`}
                      checked={selectedUserIds.includes(creator.user_id)}
                      onCheckedChange={() => handleToggleUser(creator.user_id)}
                    />
                    <label
                      htmlFor={`user-${creator.user_id}`}
                      className="cursor-pointer flex-1 min-w-0"
                    >
                      <div className="text-sm font-medium truncate">
                        {creator.name ||
                          creator.email ||
                          t("assetManager.userFilter.unnamed")}
                      </div>
                      {creator.name && creator.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {creator.email}
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
