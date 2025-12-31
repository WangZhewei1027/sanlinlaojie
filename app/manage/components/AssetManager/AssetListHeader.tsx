import type { Tag } from "../../types";
import { TagFilter } from "./TagFilter";

interface AssetListHeaderProps {
  totalCount: number;
  filteredCount: number;
  tags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function AssetListHeader({
  totalCount,
  filteredCount,
  tags,
  selectedTagIds,
  onTagsChange,
}: AssetListHeaderProps) {
  const hasFilters = selectedTagIds.length > 0;

  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">资产列表</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? (
              <>
                显示 {filteredCount} 个 / 共 {totalCount} 个资产
              </>
            ) : (
              <>共 {totalCount} 个资产</>
            )}
          </p>
        </div>
        <TagFilter
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagsChange={onTagsChange}
        />
      </div>
    </div>
  );
}
