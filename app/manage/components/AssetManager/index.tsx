import { Card } from "@/components/ui/card";
import type { Asset } from "../../types";
import { AssetCard } from "./AssetCard";
import { AssetListHeader } from "./AssetListHeader";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

interface AssetManagerProps {
  assets: Asset[];
  loading: boolean;
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetManager({
  assets,
  loading,
  onFocusAsset,
}: AssetManagerProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <AssetListHeader totalCount={assets.length} />

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onFocusAsset={onFocusAsset} />
        ))}
      </div>
    </Card>
  );
}
