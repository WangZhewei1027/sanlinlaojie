"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { MatchingFeatureStatus } from "./MatchingFeatureStatus";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { FileDropzone } from "../upload/file-dropzone";

import type { MatchingPointPanelProps } from "./matching-point-types";
export type { MatchingStatus } from "./matching-point-types";
import { MatchingPointAttachments } from "./MatchingPointAttachments";
export function MatchingPointPanel(props: MatchingPointPanelProps) {
  const { t } = useTranslation();
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!props.imageFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(props.imageFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [props.imageFile]);
  const status = props.imageFile && props.status !== "saving" ? "unsaved" : props.status;
  const busy = ["processing", "loading", "saving"].includes(status);
  const url = localUrl || props.imageUrl;
  return (
    <div className="space-y-4">
      <MatchingFeatureStatus status={status} updatedAt={props.updatedAt} error={props.statusError} onRefresh={props.onRefresh} />
      <div className="space-y-2">
        <Text as="h4" variant="bodySm" fontWeight="semibold">
          {t("matching.referenceImage")}
        </Text>
        {url && (
          <img
            src={url}
            alt={t("matching.referenceImage")}
            className="w-full max-h-64 rounded-md object-contain bg-muted"
          />
        )}
        {props.isEditing && (
          <FileDropzone
            file={props.imageFile}
            onFileSelect={props.onImageSelect}
            onFileRemove={props.onImageRemove}
            accept="image/jpeg,image/png,image/webp"
            label={t("matching.referenceImage")}
          />
        )}
        <Text as="p" variant="bodySm" tone="subdued">
          {t("matching.imageHint")}
        </Text>
        {props.error && (
          <Text as="p" variant="bodySm" tone="critical" role="alert">
            {props.error}
          </Text>
        )}
        {props.canManage && !props.isEditing && props.imageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || props.status === "unconfigured"}
            onClick={props.onRebuild}
          >
            {props.status === "processing" && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {t(props.status === "processing" ? "matching.processing" : props.status === "ready" ? "matching.regenerate" : props.status === "failed" ? "matching.retryGeneration" : "matching.generate")}
          </Button>
        )}
      </div>
      <MatchingPointAttachments {...props} />
    </div>
  );
}
