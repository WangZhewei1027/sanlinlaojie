"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileUploadService } from "../manage/lib/upload/service";
import { LocationData } from "../manage/lib/upload/types";
import { GPSStatusCard } from "./components/GPSStatusCard";
import { ModeSelector } from "./components/ModeSelector";
import { CameraUpload } from "./components/CameraUpload";
import { TextUpload } from "./components/TextUpload";
import { StatusMessages } from "./components/StatusMessages";
import { WorkspaceSelect } from "../manage/components/WorkspaceSelect";
import { useGPS } from "./hooks/useGPS";
import { useWorkspace } from "./hooks/useWorkspace";

type UploadMode = "camera" | "text";

export default function UploadOnsitePage() {
  const { t } = useTranslation();
  const uploadService = new FileUploadService();
  const { gpsPosition, gpsError, gpsLoading } = useGPS();
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    userId,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();

  const [mode, setMode] = useState<UploadMode>("camera");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 上传拍摄的照片
  const handlePhotoUpload = async (capturedImage: string) => {
    if (!gpsPosition || !selectedWorkspaceId || !userId) {
      setError(t("onsite.missingInfo"));
      throw new Error(t("onsite.missingInfo"));
    }

    setError(null);

    try {
      const blob = await (await fetch(capturedImage)).blob();
      const file = new File([blob], `onsite-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      const fileUrl = await uploadService.uploadToStorage(file, userId);

      const location: LocationData = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        height: gpsPosition.altitude || 0,
      };

      await uploadService.saveToDatabase(selectedWorkspaceId, userId, {
        fileUrl,
        fileType: "image",
        location,
        gpsSource: "device_gps",
        metadata: {
          gps_accuracy: gpsPosition.accuracy,
          capture_time: new Date(gpsPosition.timestamp).toISOString(),
        },
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
    if (!gpsPosition || !selectedWorkspaceId || !userId) {
      setError(t("onsite.missingInfo"));
      throw new Error(t("onsite.missingInfo"));
    }

    setError(null);

    try {
      const location: LocationData = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        height: gpsPosition.altitude || 0,
      };

      await uploadService.saveText(
        selectedWorkspaceId,
        userId,
        textContent,
        location
      );

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
          gpsError={gpsError || workspaceError}
          gpsLoading={gpsLoading}
        />

        <WorkspaceSelect
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedWorkspace={selectedWorkspace}
          onWorkspaceChange={setSelectedWorkspaceId}
          loading={workspaceLoading}
        />

        <ModeSelector mode={mode} onModeChange={setMode} />

        {mode === "camera" && (
          <CameraUpload onUpload={handlePhotoUpload} disabled={!gpsPosition} />
        )}

        {mode === "text" && (
          <TextUpload onUpload={handleTextUpload} disabled={!gpsPosition} />
        )}

        <StatusMessages error={error} success={success} />
      </div>
    </div>
  );
}
