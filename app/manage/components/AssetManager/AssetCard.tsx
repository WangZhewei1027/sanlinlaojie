import { useState } from "react";
import type { Asset } from "../../types";
import { AssetCardCollapsed } from "./AssetCardCollapsed";
import { AssetCardExpanded } from "./AssetCardExpanded";

interface AssetCardProps {
  asset: Asset;
  onFocusAsset?: (asset: Asset) => void;
  onUpdateAsset?: (assetId: string, updates: Partial<Asset>) => Promise<Asset>;
  onDeleteAsset?: (assetId: string) => Promise<void>;
}

export function AssetCard({
  asset,
  onFocusAsset,
  onUpdateAsset,
  onDeleteAsset,
}: AssetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedData, setEditedData] = useState({
    text_content: asset.text_content || "",
    longitude: asset.metadata.longitude?.toString() || "",
    latitude: asset.metadata.latitude?.toString() || "",
    height: asset.metadata.height?.toString() || "",
  });

  const hasLocation =
    asset.metadata &&
    (asset.metadata.longitude !== undefined ||
      asset.metadata.latitude !== undefined);

  const fileName = asset.file_url?.split("/").pop() || "未命名文件";

  const handleSave = async () => {
    if (onUpdateAsset) {
      setIsSaving(true);
      try {
        const updates: Partial<Asset> = {
          metadata: {
            longitude: editedData.longitude
              ? parseFloat(editedData.longitude)
              : undefined,
            latitude: editedData.latitude
              ? parseFloat(editedData.latitude)
              : undefined,
            height: editedData.height
              ? parseFloat(editedData.height)
              : undefined,
          },
        };

        if (asset.file_type === "text") {
          updates.text_content = editedData.text_content;
        }

        await onUpdateAsset(asset.id, updates);
        setIsEditing(false);
      } catch (error) {
        console.error("保存失败:", error);
        alert("保存失败，请重试");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedData({
      text_content: asset.text_content || "",
      longitude: asset.metadata.longitude?.toString() || "",
      latitude: asset.metadata.latitude?.toString() || "",
      height: asset.metadata.height?.toString() || "",
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (onDeleteAsset) {
      setIsDeleting(true);
      try {
        await onDeleteAsset(asset.id);
        setShowDeleteDialog(false);
      } catch (error) {
        console.error("删除失败:", error);
        alert("删除失败，请重试");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-all">
      {/* 折叠视图 */}
      <AssetCardCollapsed
        asset={asset}
        isExpanded={isExpanded}
        hasLocation={hasLocation}
        fileName={fileName}
        onToggle={() => setIsExpanded(!isExpanded)}
        onFocusAsset={onFocusAsset}
      />

      {/* 展开视图 */}
      {isExpanded && (
        <AssetCardExpanded
          asset={asset}
          fileName={fileName}
          isEditing={isEditing}
          isSaving={isSaving}
          isDeleting={isDeleting}
          showDeleteDialog={showDeleteDialog}
          editedData={editedData}
          onEdit={() => setIsEditing(true)}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={onDeleteAsset ? handleDelete : undefined}
          onShowDeleteDialog={
            onDeleteAsset ? () => setShowDeleteDialog(true) : undefined
          }
          onHideDeleteDialog={() => setShowDeleteDialog(false)}
          onTextChange={(text) =>
            setEditedData({ ...editedData, text_content: text })
          }
          onLongitudeChange={(value) =>
            setEditedData({ ...editedData, longitude: value })
          }
          onLatitudeChange={(value) =>
            setEditedData({ ...editedData, latitude: value })
          }
          onHeightChange={(value) =>
            setEditedData({ ...editedData, height: value })
          }
        />
      )}
    </div>
  );
}
