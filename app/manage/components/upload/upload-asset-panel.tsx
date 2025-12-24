"use client";

import { useState } from "react";
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
  const workspaceId = useManageStore((state) => state.selectedWorkspaceId);
  const clickedLocation = useManageStore((state) => state.clickedLocation);
  const router = useRouter();
  const uploadService = new FileUploadService();

  // State
  const [uploadType, setUploadType] = useState<UploadType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location selection
  const locationSelection = useLocationSelection(clickedLocation);

  const handleUpload = async () => {
    setError(null);
    setUploading(true);

    try {
      if (!workspaceId) {
        throw new Error("请先选择工作空间");
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("请先登录");
      }

      const { location: finalLocation, source: gpsSource } =
        locationSelection.getFinalLocation();

      // 处理不同类型的上传
      if (uploadType === "link") {
        if (!link.trim()) throw new Error("请输入链接地址");
        await uploadService.saveLink(
          workspaceId,
          user.id,
          link,
          finalLocation || undefined
        );
      } else if (uploadType === "text") {
        if (!text.trim()) throw new Error("请输入文本内容");
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
        throw new Error("请选择文件");
      }

      // 成功回调
      onUpload?.();

      // 重置表单
      resetForm();

      // 刷新页面数据
      router.refresh();
    } catch (err) {
      console.error("上传失败:", err);
      setError(err instanceof Error ? err.message : "上传失败");
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
      console.error("文件处理失败:", error);
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
    locationSelection.setExifLocation(null);
  };

  const isFileType = !["link", "text"].includes(uploadType);

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
              <h3 className="font-semibold text-sm">上传资源</h3>
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
                  label={`选择${FILE_TYPE_CONFIGS[uploadType].label}`}
                  disabled={uploading}
                />
              )}

              {/* 链接输入 */}
              {uploadType === "link" && (
                <div className="space-y-2">
                  <Label htmlFor="link" className="text-xs">
                    链接地址
                  </Label>
                  <Input
                    id="link"
                    type="url"
                    placeholder="https://example.com"
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
                    文本内容
                  </Label>
                  <textarea
                    id="text"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="输入文本内容..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
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
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    上传
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
