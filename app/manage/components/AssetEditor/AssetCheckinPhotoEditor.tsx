"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AssetCheckinPhotoEditorProps {
  /** 当前已保存的打卡凭证 URL（来自 metadata.checkin_url） */
  checkinUrl?: string | null;
  /** 编辑模式下用户选择的待上传文件 */
  checkinFile: File | null;
  isEditing: boolean;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
}

export function AssetCheckinPhotoEditor({
  checkinUrl,
  checkinFile,
  isEditing,
  onFileSelect,
  onFileRemove,
}: AssetCheckinPhotoEditorProps) {
  const { t } = useTranslation();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onFileSelect(acceptedFiles[0]);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled: !isEditing,
  });

  // 展示预览：优先使用本地选择的文件（预览 URL），否则用已保存的 URL
  const previewUrl = checkinFile
    ? URL.createObjectURL(checkinFile)
    : (checkinUrl ?? null);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {t("assetEditor.shop.checkinPhoto")}
      </Label>

      {/* 已有图片 / 本地选择预览 */}
      {previewUrl && (
        <div className="relative rounded-md overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={t("assetEditor.shop.checkinPhoto")}
            className="w-full h-auto"
          />
          {isEditing && (
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
      )}

      {/* 编辑模式下的 Dropzone（没有图片时，或替换时） */}
      {isEditing && !previewUrl && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {isDragActive
              ? t("upload.fileDropzone.dropActive")
              : t("assetEditor.shop.checkinDropHint")}
          </p>
        </div>
      )}

      {/* 编辑模式下有图片时显示替换按钮 */}
      {isEditing && previewUrl && (
        <div
          {...getRootProps()}
          className="border border-dashed rounded-md px-3 py-2 text-center cursor-pointer text-xs text-muted-foreground hover:border-primary/50 transition-colors"
        >
          <input {...getInputProps()} />
          {t("assetEditor.shop.checkinReplace")}
        </div>
      )}

      {!isEditing && !previewUrl && (
        <p className="text-xs text-muted-foreground">
          {t("assetEditor.shop.checkinNone")}
        </p>
      )}
    </div>
  );
}
