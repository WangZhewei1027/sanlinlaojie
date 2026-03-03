import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Tag } from "../../types";
import { TagFilter } from "./TagFilter";

interface AssetListHeaderProps {
  totalCount: number;
  filteredCount: number;
  tags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function AssetListHeader({
  totalCount,
  filteredCount,
  tags,
  selectedTagIds,
  onTagsChange,
  onRefresh,
  refreshing = false,
}: AssetListHeaderProps) {
  const { t } = useTranslation();
  const hasFilters = selectedTagIds.length > 0;

  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t("assetManager.title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters
              ? t("assetManager.showing", {
                  filtered: filteredCount,
                  total: totalCount,
                })
              : t("assetManager.total", { count: totalCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            title={t("assetManager.refresh")}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <TagFilter
            tags={tags}
            selectedTagIds={selectedTagIds}
            onTagsChange={onTagsChange}
          />
        </div>
      </div>
    </div>
  );
}
