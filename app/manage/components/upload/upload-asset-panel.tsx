"use client";

import { useState } from "react";
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
import { useRouter } from "next/navigation";
import { FileUploadService } from "@/lib/upload/service";
import { UploadType } from "@/lib/upload/types";
import { FILE_TYPE_CONFIGS } from "@/lib/upload/config";
import { useLocationSelection } from "@/lib/upload/hooks";
import { LocationSelector } from "./location-selector";
import { FileTypeSelector } from "./file-type-selector";
import { FileDropzone } from "./file-dropzone";
import { useManageStore } from "../../store";

interface UploadAssetPanelProps {
  onUpload?: () => void;
}

export function UploadAssetPanel({ onUpload }: UploadAssetPanelProps) {
  const { t } = useTranslation();
  const workspaceId = useManageStore((state) => state.selectedWorkspaceId);
  const clickedLocation = useManageStore((state) => state.clickedLocation);
  const router = useRouter();
  const uploadService = new FileUploadService();

  // State
  const [uploadType, setUploadType] = useState<UploadType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location selection
  const locationSelection = useLocationSelection(clickedLocation);

  const handleUpload = async () => {
    setError(null);
    setUploading(true);

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
      if (uploadType === "anchor") {
        // 锚点必须有位置和名称
        if (!finalLocation) {
          throw new Error(t("upload.anchorRequiresLocation"));
        }
        if (!name.trim()) {
          throw new Error(t("upload.anchorRequiresName"));
        }
        await uploadService.saveAnchor(workspaceId, user.id, {
          name: name.trim(),
          location: finalLocation,
          text: text.trim() || undefined,
        });
      } else if (uploadType === "link") {
        if (!link.trim()) throw new Error(t("upload.enterLink"));
        await uploadService.saveLink(
          workspaceId,
          user.id,
          link,
          finalLocation || undefined
        );
      } else if (uploadType === "text") {
        if (!text.trim()) throw new Error(t("upload.enterText"));
        await uploadService.saveText(
          workspaceId,
          user.id,
          text,
          finalLocation || undefined
        );
      } else if (file) {
        // 文件上传
        const processedFile = await uploadService.processFile(file);
        const fileUrl = await uploadService.uploadToStorage(
          processedFile.file,
          user.id
        );

        await uploadService.saveToDatabase(workspaceId, user.id, {
          fileUrl,
          fileType: processedFile.type,
          location: finalLocation || undefined,
          gpsSource: gpsSource || undefined,
        });
      } else {
        throw new Error(t("upload.selectFile"));
      }

      // 成功回调
      onUpload?.();

      // 重置表单
      resetForm();

      // 刷新页面数据
      router.refresh();
    } catch (err) {
      console.error(t("upload.uploadFailed"), err);
      setError(err instanceof Error ? err.message : t("upload.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    setFile(selectedFile);

    // 处理文件并提取元数据
    try {
      const processedFile = await uploadService.processFile(selectedFile);
      if (processedFile.gpsSource) {
        locationSelection.setExifLocation(processedFile.gpsSource.location);
      } else {
        locationSelection.setExifLocation(null);
      }
    } catch (error) {
      console.error(t("upload.fileProcessingFailed"), error);
    }
  };

  const handleFileRemove = () => {
    setFile(null);
    locationSelection.setExifLocation(null);
  };

  const resetForm = () => {
    setFile(null);
    setLink("");
    setText("");
    setName("");
    locationSelection.setExifLocation(null);
  };

  const isFileType = !["link", "text", "anchor"].includes(uploadType);

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
              <h3 className="font-semibold text-sm">{t("upload.title")}</h3>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              {/* 文件类型选择 */}
              <FileTypeSelector
                selectedType={uploadType}
                onTypeChange={setUploadType}
              />

              {/* 文件上传 */}
              {isFileType && (
                <FileDropzone
                  file={file}
                  onFileSelect={processSelectedFile}
                  onFileRemove={handleFileRemove}
                  accept={FILE_TYPE_CONFIGS[uploadType].accept}
                  label={t("upload.fields.select", {
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
                    type="url"
                    placeholder={t("upload.fields.linkPlaceholder")}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="text-xs"
                  />
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
