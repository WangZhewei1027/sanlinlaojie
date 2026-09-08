"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClient } from "@/lib/supabase/client";
import {
  FileUploadService,
  StorageUploadResult,
} from "@/lib/upload/service";
import { UploadFile, UploadType, UploadedAsset } from "@/lib/upload/types";
import {
  DEFAULT_UPLOAD_TYPES,
  FILE_TYPE_CONFIGS,
  getEffectiveMaxSizeMB,
  validateFileSize,
} from "@/lib/upload/config";
import { useLocationSelection } from "@/lib/upload/hooks";
import { LocationSelector } from "./location-selector";
import { FileTypeSelector } from "./file-type-selector";
import { FileDropzone } from "./file-dropzone";
import { useManageStore } from "../../store";
import { isSpecificWorkspaceId } from "../../constants";
import type { Asset } from "../../types";
import { Text } from "@/components/ui/typography";
import {
  getLinkAssetErrorKey,
  LinkAssetParseError,
  parseLinkAssetInput,
  type LinkAssetData,
} from "@/lib/link-asset";
import { AssetLinkPreview } from "../AssetEditor/previews/AssetLinkPreview";

interface UploadAssetPanelProps {
  onUpload?: () => void;
}

export function UploadAssetPanel({ onUpload }: UploadAssetPanelProps) {
  const { t } = useTranslation();
  const storeWorkspaceId = useManageStore((state) => state.selectedWorkspaceId);
  // Treat the "All workspaces" sentinel as no workspace for upload purposes.
  const workspaceId = isSpecificWorkspaceId(storeWorkspaceId)
    ? storeWorkspaceId
    : null;
  const clickedLocation = useManageStore((state) => state.clickedLocation);
  const selectedOrganization = useManageStore(
    (state) => state.selectedOrganization,
  );
  const addAsset = useManageStore((state) => state.addAsset);
  const uploadService = new FileUploadService();

  // 从 organization 配置获取允许的文件类型（null → 默认集合，与组织设置表单一致）
  const allowedTypes = (selectedOrganization?.allowed_file_types ??
    undefined) as UploadType[] | undefined;

  const effectiveTypes = allowedTypes ?? DEFAULT_UPLOAD_TYPES;

  // State
  const [uploadType, setUploadType] = useState<UploadType>(
    effectiveTypes[0] ?? "image",
  );

  // 当允许的文件类型变化时，确保当前选择有效
  useEffect(() => {
    if (!effectiveTypes.includes(uploadType)) {
      setUploadType(effectiveTypes[0] ?? "image");
    }
  }, [effectiveTypes, uploadType]);
  const [file, setFile] = useState<File | null>(null);
  // 选择文件时的处理结果缓存（压缩 + EXIF），上传时复用，避免二次处理；
  // source 与当前 file 不一致时视为失效
  const [processedCache, setProcessedCache] = useState<{
    source: File;
    result: UploadFile;
  } | null>(null);
  const [checkinFile, setCheckinFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkPreview = useMemo<{
    data: LinkAssetData | null;
    errorKey: string | null;
  }>(() => {
    if (!link.trim()) return { data: null, errorKey: null };
    try {
      return { data: parseLinkAssetInput(link), errorKey: null };
    } catch (linkError) {
      return { data: null, errorKey: getLinkAssetErrorKey(linkError) };
    }
  }, [link]);

  // Location selection
  const locationSelection = useLocationSelection(clickedLocation);

  const handleUpload = async () => {
    setError(null);
    setUploading(true);

    // 本次已上传的新存储对象；后续 DB 写入失败时用于补偿删除（复用对象的
    // storagePath 为 null，cleanupUploadedFile 会自动跳过）
    const uploadedFiles: StorageUploadResult[] = [];

    try {
      if (!workspaceId) {
        throw new Error(t("upload.selectWorkspace"));
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(t("upload.pleaseLogin"));
      }

      const { location: finalLocation, source: gpsSource } =
        locationSelection.getFinalLocation();

      // 处理不同类型的上传
      let created: UploadedAsset;
      if (uploadType === "anchor") {
        // 锚点必须有位置和名称
        if (!finalLocation) {
          throw new Error(t("upload.anchorRequiresLocation"));
        }
        if (!name.trim()) {
          throw new Error(t("upload.anchorRequiresName"));
        }
        if (!file) throw new Error(t("matching.imageRequired"));
        const processed = await uploadService.processFile(file, "anchor");
        const uploaded = await uploadService.uploadToStorage(processed.file, user.id, { type: "anchor", workspaceId });
        uploadedFiles.push(uploaded);
        created = await uploadService.saveAnchor(workspaceId, user.id, {
          fileUrl: uploaded.url,
          contentHash: uploaded.contentHash,
          name: name.trim(),
          location: finalLocation,
          text: text.trim() || undefined,
        });
      } else if (uploadType === "link") {
        const linkData = parseLinkAssetInput(link);
        created = await uploadService.saveLink(
          workspaceId,
          user.id,
          linkData,
          finalLocation || undefined,
        );
      } else if (uploadType === "text") {
        if (!text.trim()) throw new Error(t("upload.enterText"));
        created = await uploadService.saveText(
          workspaceId,
          user.id,
          text,
          finalLocation || undefined,
        );
      } else if (uploadType === "model") {
        if (!file) throw new Error(t("upload.selectFile"));
        if (!validateFileSize(file, getEffectiveMaxSizeMB("model")))
          throw new Error(t("upload.fields.modelTooLarge"));
        const uploaded = await uploadService.uploadToStorage(file, user.id, {
          type: "model",
          workspaceId,
        });
        uploadedFiles.push(uploaded);
        created = await uploadService.saveToDatabase(workspaceId, user.id, {
          fileUrl: uploaded.url,
          contentHash: uploaded.contentHash,
          fileType: "model",
          name: name.trim() || undefined,
          location: finalLocation || undefined,
          gpsSource: gpsSource || undefined,
        });
      } else if (uploadType === "video") {
        if (!file) throw new Error(t("upload.selectFile"));
        if (!validateFileSize(file, getEffectiveMaxSizeMB("video")))
          throw new Error(t("upload.fields.videoTooLarge"));
        const uploaded = await uploadService.uploadToStorage(file, user.id, {
          type: "video",
          workspaceId,
        });
        uploadedFiles.push(uploaded);
        created = await uploadService.saveToDatabase(workspaceId, user.id, {
          fileUrl: uploaded.url,
          contentHash: uploaded.contentHash,
          fileType: "video",
          location: finalLocation || undefined,
          gpsSource: gpsSource || undefined,
        });
      } else if (uploadType === "shop") {
        if (!file) throw new Error(t("upload.selectFile"));
        const processedFile =
          processedCache?.source === file
            ? processedCache.result
            : await uploadService.processFile(file);
        const uploaded = await uploadService.uploadToStorage(
          processedFile.file,
          user.id,
          { type: "shop", workspaceId },
        );
        uploadedFiles.push(uploaded);
        let checkinUrl: string | undefined;
        if (checkinFile) {
          const processedCheckin = await uploadService.processFile(checkinFile);
          const uploadedCheckin = await uploadService.uploadToStorage(
            processedCheckin.file,
            user.id,
            { type: "shop", workspaceId },
          );
          uploadedFiles.push(uploadedCheckin);
          checkinUrl = uploadedCheckin.url;
        }
        created = await uploadService.saveToDatabase(workspaceId, user.id, {
          fileUrl: uploaded.url,
          contentHash: uploaded.contentHash,
          fileType: "shop",
          name: name.trim() || undefined,
          textContent: text.trim() || undefined,
          location: finalLocation || undefined,
          gpsSource: gpsSource || undefined,
          checkinUrl,
        });
      } else if (file) {
        // 文件上传（选择时的处理结果可复用，避免重复压缩/解析）
        const processedFile =
          processedCache?.source === file
            ? processedCache.result
            : await uploadService.processFile(file);
        const uploaded = await uploadService.uploadToStorage(
          processedFile.file,
          user.id,
          { type: processedFile.type, workspaceId },
        );
        uploadedFiles.push(uploaded);

        created = await uploadService.saveToDatabase(workspaceId, user.id, {
          fileUrl: uploaded.url,
          contentHash: uploaded.contentHash,
          fileType: processedFile.type,
          location: finalLocation || undefined,
          gpsSource: gpsSource || undefined,
        });
      } else {
        throw new Error(t("upload.selectFile"));
      }

      // 本地插入新资产：列表/地图立即可见，且不打断滚动位置与过滤器状态
      addAsset(created as Asset);

      // 成功回调
      onUpload?.();

      // 重置表单
      resetForm();
    } catch (err) {
      console.error(t("upload.uploadFailed"), err);
      // DB 写入失败时补偿删除刚上传的新存储对象（尽力而为，绝不掩盖原始错误）
      if (uploadedFiles.length > 0) {
        await Promise.all(
          uploadedFiles.map((f) => uploadService.cleanupUploadedFile(f)),
        );
      }
      setError(
        err instanceof LinkAssetParseError
          ? t(getLinkAssetErrorKey(err))
          : err instanceof Error
            ? err.message
            : t("upload.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setProcessedCache(null);
    setError(null);

    // 处理文件并提取元数据；结果缓存供上传时复用，避免二次压缩/解析
    try {
      const processedFile = await uploadService.processFile(selectedFile, uploadType === "anchor" ? "anchor" : undefined);
      setProcessedCache({ source: selectedFile, result: processedFile });
      if (processedFile.gpsSource) {
        locationSelection.setExifLocation(processedFile.gpsSource.location);
      } else {
        locationSelection.setExifLocation(null);
      }
    } catch (error) {
      console.error(t("upload.fileProcessingFailed"), error);
      // 选择阶段即提示（如超出大小限制），而非等到点击上传才失败
      setError(
        error instanceof Error
          ? error.message
          : t("upload.fileProcessingFailed"),
      );
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    setProcessedCache(null);
    locationSelection.setExifLocation(null);
  };

  const resetForm = () => {
    setFile(null);
    setProcessedCache(null);
    setCheckinFile(null);
    setLink("");
    setText("");
    setName("");
    locationSelection.setExifLocation(null);
  };

  const isFileType = !["link", "text"].includes(uploadType);

  // 用户已开始填写内容：选了文件或输入了任意文字，此时展示坐标区（无坐标则提示去地图点选）
  const hasContent =
    !!file ||
    !!checkinFile ||
    !!link.trim() ||
    !!text.trim() ||
    !!name.trim();

  return (
    <Card className="p-0">
      <Accordion
        type="single"
        collapsible
        defaultValue="upload"
        className="w-full"
      >
        <AccordionItem value="upload" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <Text as="h3" variant="bodySm" fontWeight="semibold">{t("upload.title")}</Text>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* 文件类型选择 */}
              <FileTypeSelector
                selectedType={uploadType}
                onTypeChange={(type) => { resetForm(); setError(null); setUploadType(type); }}
                types={effectiveTypes}
              />

              {/* 文件上传 */}
              {isFileType && (
                <FileDropzone
                  file={file}
                  onFileSelect={processSelectedFile}
                  onFileRemove={handleFileRemove}
                  accept={FILE_TYPE_CONFIGS[uploadType].accept}
                  label={uploadType === "anchor" ? t("matching.referenceImage") : t("upload.fields.select", {
                    type: t(FILE_TYPE_CONFIGS[uploadType].label),
                  })}
                  disabled={uploading}
                />
              )}

              {/* 链接输入 */}
              {uploadType === "link" && (
                <div className="space-y-2">
                  <Label htmlFor="link" className="text-xs">
                    {t("upload.fields.linkAddress")}
                  </Label>
                  <Input
                    id="link"
                    type="text"
                    placeholder={t("upload.fields.linkPlaceholder")}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    aria-invalid={!!linkPreview.errorKey}
                    disabled={uploading}
                    className="text-xs"
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("linkAsset.fields.hint")}
                  </Text>
                  {linkPreview.errorKey && (
                    <Text as="p" variant="bodySm" tone="critical">
                      {t(linkPreview.errorKey)}
                    </Text>
                  )}
                  {linkPreview.data && (
                    <AssetLinkPreview
                      linkData={linkPreview.data}
                      fileName={t("assetEditor.preview.link")}
                      compact
                    />
                  )}
                </div>
              )}

              {/* 文本输入 */}
              {uploadType === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="text" className="text-xs">
                    {t("upload.fields.textContent")}
                  </Label>
                  <textarea
                    id="text"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={t("upload.fields.textPlaceholder")}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
              )}

              {/* 3D 模型名称 */}
              {uploadType === "model" && (
                <div className="space-y-2">
                  <Label htmlFor="model-name" className="text-xs">
                    {t("upload.fields.modelName")}
                  </Label>
                  <Input
                    id="model-name"
                    type="text"
                    placeholder={t("upload.fields.modelNamePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              {/* 店铺输入 */}
              {uploadType === "shop" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop-name" className="text-xs">
                      {t("upload.fields.shopName")}
                    </Label>
                    <Input
                      id="shop-name"
                      type="text"
                      placeholder={t("upload.fields.shopNamePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop-text" className="text-xs">
                      {t("upload.fields.shopDescription")}
                    </Label>
                    <textarea
                      id="shop-text"
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={t("upload.fields.shopDescPlaceholder")}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                  <FileDropzone
                    file={checkinFile}
                    onFileSelect={setCheckinFile}
                    onFileRemove={() => setCheckinFile(null)}
                    accept="image/*"
                    label={t("upload.fields.shopCheckinPhoto")}
                    disabled={uploading}
                  />
                </div>
              )}

              {/* 锚点输入 */}
              {uploadType === "anchor" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anchor-name" className="text-xs">
                      {t("upload.fields.anchorName")}{" "}
                      <span className="text-destructive">
                        {t("upload.fields.anchorNameRequired")}
                      </span>
                    </Label>
                    <Input
                      id="anchor-name"
                      type="text"
                      placeholder={t("upload.fields.anchorNamePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anchor-text" className="text-xs">
                      {t("upload.fields.anchorDescription")}
                    </Label>
                    <textarea
                      id="anchor-text"
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={t("upload.fields.anchorDescPlaceholder")}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("upload.fields.anchorNote")}
                  </p>
                </div>
              )}

              {/* 位置选择 */}
              <LocationSelector
                clickedLocation={clickedLocation}
                locationSelection={locationSelection}
                hasContent={hasContent}
              />

              {/* 错误提示 */}
              {error && (
                <div className="p-2 bg-destructive/10 border border-destructive rounded-md">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* 上传按钮 */}
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("upload.uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("upload.uploadButton")}
                  </>
                )}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
