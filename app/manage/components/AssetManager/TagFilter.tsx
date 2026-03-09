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
import { Filter, X } from "lucide-react";
import type { Tag } from "../../types";

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function TagFilter({
  tags,
  selectedTagIds,
  onTagsChange,
}: TagFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  const hasFilters = selectedTagIds.length > 0;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={hasFilters ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            {t("assetManager.tagFilter.title")}
            {hasFilters && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 h-4 min-w-4">
                {selectedTagIds.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <span className="text-sm font-medium">
                {t("assetManager.tagFilter.selectTags")}
              </span>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t("assetManager.tagFilter.clear")}
                </Button>
              )}
            </div>

            {tags.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                {t("assetManager.tagFilter.noTags")}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => handleToggleTag(tag.id)}
                  >
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
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
