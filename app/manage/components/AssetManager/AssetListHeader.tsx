interface AssetListHeaderProps {
  totalCount: number;
}

export function AssetListHeader({ totalCount }: AssetListHeaderProps) {
  return (
    <div className="p-4 border-b">
      <h3 className="font-semibold text-lg">资产列表</h3>
      <p className="text-sm text-muted-foreground mt-1">
        共 {totalCount} 个资产
      </p>
    </div>
  );
}
