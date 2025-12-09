"use client";

import { useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { compressToWebP } from "@/lib/image-compression";
import { extractGPSFromImage } from "@/lib/exif-reader";

interface LocationData {
  longitude: number;
  latitude: number;
  height: number;
}

interface UploadAssetPanelProps {
  location?: LocationData | null;
  onUpload?: (data: UploadData) => void;
  workspaceId: string;
}

interface UploadData {
  type: "file" | "link" | "text";
  file?: File;
  link?: string;
  text?: string;
  location?: LocationData;
}

export function UploadAssetPanel({
  location,
  onUpload,
  workspaceId,
}: UploadAssetPanelProps) {
  const router = useRouter();
  const [uploadType, setUploadType] = useState<"file" | "link" | "text">(
    "file"
  );
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exifLocation, setExifLocation] = useState<LocationData | null>(null);

  const handleUpload = async () => {
    setError(null);
    setUploading(true);

    try {
      const supabase = createClient();

      // 获取当前用户
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("请先登录");
      }

      let fileUrl: string | null = null;
      let fileType = "";

      // 处理文件上传
      if (uploadType === "file" && file) {
        let fileToUpload = file;

        // 如果是图片，先压缩为 WebP
        if (file.type.startsWith("image/")) {
          try {
            fileToUpload = await compressToWebP(file);
            console.log(
              `图片压缩完成: ${(file.size / 1024).toFixed(2)}KB -> ${(
                fileToUpload.size / 1024
              ).toFixed(2)}KB`
            );
          } catch (compressionError) {
            console.warn("图片压缩失败，使用原文件:", compressionError);
          }
        }

        // 生成唯一文件名
        const fileExt = fileToUpload.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // 上传到 Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;

        // 获取公开 URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("assets").getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileType = fileToUpload.type.startsWith("image/")
          ? "image"
          : fileToUpload.type.startsWith("video/")
          ? "video"
          : "file";
      }

      // 准备 PostGIS geometry (POINT)
      const finalLocation = exifLocation || location;
      const geometry = finalLocation
        ? `POINT(${finalLocation.longitude} ${finalLocation.latitude})`
        : null;

      // 插入数据库记录
      const { error: dbError } = await supabase.from("asset").insert({
        workspace_id: workspaceId,
        created_by: user.id,
        file_type: fileType || uploadType,
        file_url: fileUrl,
        link: uploadType === "link" ? link : null,
        text_content: uploadType === "text" ? text : null,
        location: geometry,
        metadata: {
          longitude: finalLocation?.longitude,
          latitude: finalLocation?.latitude,
          height: finalLocation?.height,
          upload_time: new Date().toISOString(),
          gps_source: exifLocation ? "exif" : location ? "user_click" : null,
        },
      });

      if (dbError) throw dbError;

      // 成功回调
      onUpload?.({
        type: uploadType,
        file: file || undefined,
        link: uploadType === "link" ? link : undefined,
        text: uploadType === "text" ? text : undefined,
        location: finalLocation || undefined,
      });

      // 重置表单
      setFile(null);
      setLink("");
      setText("");
      setExifLocation(null);

      // 刷新页面数据
      router.refresh();
    } catch (err) {
      console.error("上传失败:", err);
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // 如果是图片，尝试提取 GPS 信息
      if (selectedFile.type.startsWith("image/")) {
        extractGPSFromImage(selectedFile).then((gps) => {
          if (gps) {
            setExifLocation({
              latitude: gps.latitude,
              longitude: gps.longitude,
              height: gps.altitude || 0,
            });
            console.log("从图片中提取到 GPS 坐标:", gps);
          } else {
            setExifLocation(null);
          }
        });
      } else {
        setExifLocation(null);
      }
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">上传资源</h3>
        </div>

        {/* 上传类型选择 */}
        <div className="flex gap-2">
          <Button
            variant={uploadType === "file" ? "default" : "outline"}
            size="sm"
            onClick={() => setUploadType("file")}
            className="flex-1"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            文件
          </Button>
          <Button
            variant={uploadType === "link" ? "default" : "outline"}
            size="sm"
            onClick={() => setUploadType("link")}
            className="flex-1"
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            链接
          </Button>
          <Button
            variant={uploadType === "text" ? "default" : "outline"}
            size="sm"
            onClick={() => setUploadType("text")}
            className="flex-1"
          >
            <FileText className="mr-2 h-4 w-4" />
            文本
          </Button>
        </div>

        {/* 文件上传 */}
        {uploadType === "file" && (
          <div className="space-y-2">
            <Label htmlFor="file" className="text-xs">
              选择文件
            </Label>
            <Input
              id="file"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="text-xs"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                已选择: {file.name}
              </p>
            )}
          </div>
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

        {/* 位置信息 */}
        {(location || exifLocation) && (
          <div className="p-2 bg-muted rounded-md">
            <div className="text-xs space-y-1">
              <div className="font-semibold">
                {exifLocation ? "📷 图片GPS坐标" : "📍 上传位置"}
              </div>
              <div className="font-mono text-xs">
                {(exifLocation || location)!.longitude.toFixed(6)}°,{" "}
                {(exifLocation || location)!.latitude.toFixed(6)}°
              </div>
              {exifLocation && (
                <p className="text-muted-foreground text-xs">
                  从图片 EXIF 数据中提取
                </p>
              )}
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* 上传按钮 */}
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
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
    </Card>
  );
}
