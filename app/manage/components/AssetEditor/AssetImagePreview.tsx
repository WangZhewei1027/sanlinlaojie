"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PhotoSlider } from "react-photo-view";
import { Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import "react-photo-view/dist/react-photo-view.css";

interface AssetImagePreviewProps {
  fileUrl: string;
  fileName: string;
  isEditing?: boolean;
  /** 编辑模式下用户选择的待上传新图片 */
  newImageFile?: File | null;
  onFileSelect?: (file: File) => void;
  onFileRemove?: () => void;
}

export function AssetImagePreview({
  fileUrl,
  fileName,
  isEditing = false,
  newImageFile = null,
  onFileSelect,
  onFileRemove,
}: AssetImagePreviewProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onFileSelect?.(acceptedFiles[0]);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled: !isEditing,
  });

  // 优先显示本地选择的新图片
  const previewUrl = newImageFile
    ? URL.createObjectURL(newImageFile)
    : fileUrl;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t("assetEditor.preview.image")}
      </label>
      <div className="relative rounded-md overflow-hidden border">
        <div
          className={isEditing ? undefined : "cursor-zoom-in"}
          onClick={isEditing ? undefined : () => setVisible(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={fileName}
            className="w-full h-auto"
          />
        </div>
        {isEditing && newImageFile && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={onFileRemove}
            type="button"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {isEditing && (
        <div
          {...getRootProps()}
          className={`border border-dashed rounded-md px-3 py-2 text-center cursor-pointer text-xs text-muted-foreground transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-3.5 w-3.5 inline-block mr-1 align-text-bottom" />
          {t("assetEditor.preview.imageReplace")}
        </div>
      )}
      {!isEditing && (
        <PhotoSlider
          images={[{ src: fileUrl, key: fileUrl }]}
          visible={visible}
          onClose={() => setVisible(false)}
          index={0}
        />
      )}
      <p className="text-xs text-muted-foreground truncate">{fileUrl}</p>
    </div>
  );
}
