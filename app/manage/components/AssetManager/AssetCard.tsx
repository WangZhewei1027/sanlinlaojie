import { useManageStore } from "../../store";
import type { Asset } from "../../types";
import { AssetCardCollapsed } from "./AssetCardCollapsed";

interface AssetCardProps {
  asset: Asset;
  onFocusAsset?: (asset: Asset) => void;
}

export function AssetCard({ asset, onFocusAsset }: AssetCardProps) {
  const selectedAssetId = useManageStore((state) => state.selectedAssetId);
  const setSelectedAssetId = useManageStore(
    (state) => state.setSelectedAssetId
  );

  const isSelected = selectedAssetId === asset.id;

  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  const fileName = asset.file_url?.split("/").pop() || "未命名文件";

  const handleClick = () => {
    setSelectedAssetId(asset.id);
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={handleClick}
    >
      <AssetCardCollapsed
        asset={asset}
        isExpanded={false}
        hasLocation={hasLocation}
        fileName={fileName}
        onToggle={() => {}}
        onFocusAsset={onFocusAsset}
      />
    </div>
  );
}
