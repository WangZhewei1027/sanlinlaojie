"use client";

import type { Asset } from "../../../types";
import type { AssetTypeConfig } from "../../../config";
import { AssetImagePreview } from "./AssetImagePreview";
import { AssetAudioPreview } from "./AssetAudioPreview";
import { AssetVideoPreview } from "./AssetVideoPreview";
import { AssetLinkPreview } from "./AssetLinkPreview";
import { AssetModelPreview } from "./AssetModelPreview";
import { AssetCheckinPhotoEditor } from "../fields/AssetCheckinPhotoEditor";

interface AssetEditorPreviewSectionProps {
  asset: Asset;
  assetConfig: AssetTypeConfig | null;
  fileName: string;
  isEditing: boolean;
  imageFile: File | null;
  checkinFile: File | null;
  onImageFileSelect: (file: File) => void;
  onImageFileRemove: () => void;
  onCheckinFileSelect: (file: File) => void;
  onCheckinFileRemove: () => void;
}

export function AssetEditorPreviewSection({
  asset,
  assetConfig,
  fileName,
  isEditing,
  imageFile,
  checkinFile,
  onImageFileSelect,
  onImageFileRemove,
  onCheckinFileSelect,
  onCheckinFileRemove,
}: AssetEditorPreviewSectionProps) {
  return (
    <>
      {assetConfig?.previewType === "image" && asset.file_url && (
        <AssetImagePreview
          fileUrl={asset.file_url}
          fileName={fileName}
          isEditing={isEditing}
          newImageFile={imageFile}
          onFileSelect={onImageFileSelect}
          onFileRemove={onImageFileRemove}
        />
      )}

      {asset.file_type === "shop" && (
        <AssetCheckinPhotoEditor
          checkinUrl={asset.metadata.checkin_url}
          checkinFile={checkinFile}
          isEditing={isEditing}
          onFileSelect={onCheckinFileSelect}
          onFileRemove={onCheckinFileRemove}
        />
      )}

      {assetConfig?.previewType === "audio" && asset.file_url && (
        <AssetAudioPreview
          key={asset.file_url}
          fileUrl={asset.file_url}
          fileName={fileName}
        />
      )}

      {assetConfig?.previewType === "video" && asset.file_url && (
        <AssetVideoPreview
          key={asset.file_url}
          fileUrl={asset.file_url}
          fileName={fileName}
        />
      )}

      {assetConfig?.previewType === "link" && asset.file_url && (
        <AssetLinkPreview fileUrl={asset.file_url} fileName={fileName} />
      )}

      {assetConfig?.previewType === "model" && asset.file_url && (
        <AssetModelPreview fileUrl={asset.file_url} fileName={fileName} />
      )}
    </>
  );
}
