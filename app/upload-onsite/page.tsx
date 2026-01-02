"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileUploadService } from "@/lib/upload/service";
import { LocationData } from "@/lib/upload/types";
import { createClient } from "@/lib/supabase/client";
import { GPSStatusCard } from "./components/GPSStatusCard";
import { ModeSelector } from "./components/ModeSelector";
import { CameraUpload } from "./components/CameraUpload";
import { TextUpload } from "./components/TextUpload";
import { AudioRecorder } from "./components/AudioRecorder";
import { StatusMessages } from "./components/StatusMessages";
import { TagSelector } from "./components/TagSelector";
import { useGPS } from "./hooks/useGPS";
import { useManageStore } from "../manage/store";

type UploadMode = "camera" | "text" | "audio";

export default function UploadOnsitePage() {
  const { t } = useTranslation();
  const uploadService = new FileUploadService();
  const { gpsPosition, gpsError, gpsLoading } = useGPS();

  // 从 store 获取 workspace 信息
  const selectedWorkspaceId = useManageStore(
    (state) => state.selectedWorkspaceId
  );

  const [mode, setMode] = useState<UploadMode>("camera");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // 上传拍摄的照片
  const handlePhotoUpload = async (capturedImage: string) => {
    if (!gpsPosition || !selectedWorkspaceId) {
      setError(t("onsite.missingInfo"));
      throw new Error(t("onsite.missingInfo"));
    }

    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(t("onsite.pleaseLogin") || "请先登录");
      }

      const blob = await (await fetch(capturedImage)).blob();
      const originalFile = new File([blob], `onsite-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      console.log(
        `原始文件大小: ${(originalFile.size / 1024 / 1024).toFixed(2)}MB`
      );

      // 使用 FileUploadService 处理文件（自动压缩）
      const processedFileData = await uploadService.processFile(originalFile);

      console.log(
        `压缩后文件大小: ${(processedFileData.file.size / 1024 / 1024).toFixed(
          2
        )}MB`
      );

      // 上传到 Storage
      const fileUrl = await uploadService.uploadToStorage(
        processedFileData.file,
        user.id
      );

      const location: LocationData = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        height: gpsPosition.altitude || 0,
      };

      // 保存到数据库
      await uploadService.saveToDatabase(selectedWorkspaceId, user.id, {
        fileType: processedFileData.type,
        fileUrl,
        location,
        gpsSource: "device_gps",
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMsg = t("onsite.uploadFailed") + (err as Error).message;
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // 上传文本
  const handleTextUpload = async (textContent: string) => {
    if (!gpsPosition || !selectedWorkspaceId) {
      setError(t("onsite.missingInfo"));
      throw new Error(t("onsite.missingInfo"));
    }

    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(t("onsite.pleaseLogin") || "请先登录");
      }

      const location: LocationData = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        height: gpsPosition.altitude || 0,
      };

      // 使用 FileUploadService 保存文本
      await uploadService.saveText(
        selectedWorkspaceId,
        user.id,
        textContent,
        location,
        selectedTagIds.length > 0 ? selectedTagIds : undefined
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMsg = t("onsite.uploadFailed") + (err as Error).message;
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // 上传录音
  const handleAudioUpload = async (
    audioFile: File,
    title?: string,
    description?: string
  ) => {
    if (!gpsPosition || !selectedWorkspaceId) {
      setError(t("onsite.missingInfo"));
      throw new Error(t("onsite.missingInfo"));
    }

    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(t("onsite.pleaseLogin") || "请先登录");
      }

      console.log(
        `音频文件大小: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB`
      );

      // 使用 FileUploadService 处理音频文件（支持压缩）
      const processedFileData = await uploadService.processFile(audioFile);

      console.log(
        `处理后文件大小: ${(processedFileData.file.size / 1024 / 1024).toFixed(
          2
        )}MB`
      );

      // 上传到 Storage
      const fileUrl = await uploadService.uploadToStorage(
        processedFileData.file,
        user.id
      );

      const location: LocationData = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        height: gpsPosition.altitude || 0,
      };

      // 保存到数据库，包含标题和描述
      await uploadService.saveToDatabase(selectedWorkspaceId, user.id, {
        fileType: processedFileData.type,
        fileUrl,
        location,
        gpsSource: "device_gps",
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        name: title,
        textContent: description,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const errorMsg = t("onsite.uploadFailed") + (err as Error).message;
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t("onsite.title")}</h1>
          <p className="text-muted-foreground">{t("onsite.subtitle")}</p>
        </div>

        <GPSStatusCard
          gpsPosition={gpsPosition}
          gpsError={gpsError}
          gpsLoading={gpsLoading}
        />

        {/* 标签选择器 */}
        {selectedWorkspaceId && (
          <TagSelector
            workspaceId={selectedWorkspaceId}
            selectedTagIds={selectedTagIds}
            onTagIdsChange={setSelectedTagIds}
          />
        )}

        <ModeSelector mode={mode} onModeChange={setMode} />

        {mode === "camera" && (
          <CameraUpload onUpload={handlePhotoUpload} disabled={!gpsPosition} />
        )}

        {mode === "text" && (
          <TextUpload onUpload={handleTextUpload} disabled={!gpsPosition} />
        )}

        {mode === "audio" && (
          <AudioRecorder onUpload={handleAudioUpload} disabled={!gpsPosition} />
        )}

        <StatusMessages error={error} success={success} />
      </div>
    </div>
  );
}
