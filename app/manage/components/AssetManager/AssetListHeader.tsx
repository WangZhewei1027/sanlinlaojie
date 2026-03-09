import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Tag, Creator } from "../../types";
import { TagFilter } from "./TagFilter";
import { UserFilter } from "./UserFilter";
import { FileTypeFilter } from "./FileTypeFilter";

interface AssetListHeaderProps {
  totalCount: number;
  filteredCount: number;
  tags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  creators: Creator[];
  selectedUserIds: string[];
  onUsersChange: (userIds: string[]) => void;
  fileTypes: string[];
  selectedFileTypes: string[];
  onFileTypesChange: (types: string[]) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function AssetListHeader({
  totalCount,
  filteredCount,
  tags,
  selectedTagIds,
  onTagsChange,
  creators,
  selectedUserIds,
  onUsersChange,
  fileTypes,
  selectedFileTypes,
  onFileTypesChange,
  onRefresh,
  refreshing = false,
}: AssetListHeaderProps) {
  const { t } = useTranslation();
  const hasFilters =
    selectedTagIds.length > 0 ||
    selectedUserIds.length > 0 ||
    selectedFileTypes.length > 0;

  return (
    <div className="p-4 border-b space-y-2">
      {/* Row 1: title + count + refresh */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg">{t("assetManager.title")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasFilters
              ? t("assetManager.showing", {
                  filtered: filteredCount,
                  total: totalCount,
                })
              : t("assetManager.total", { count: totalCount })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          title={t("assetManager.refresh")}
          className="shrink-0"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Row 2: filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <TagFilter
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagsChange={onTagsChange}
        />
        <UserFilter
          creators={creators}
          selectedUserIds={selectedUserIds}
          onUsersChange={onUsersChange}
        />
        <FileTypeFilter
          fileTypes={fileTypes}
          selectedFileTypes={selectedFileTypes}
          onFileTypesChange={onFileTypesChange}
        />
      </div>
    </div>
  );
}
