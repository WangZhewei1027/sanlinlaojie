"use client";
import { Text } from "@/components/ui/typography";
import { UPLOAD_SOURCE_MAX_MB, VIDEO_MAX_DURATION_SECONDS } from "@/lib/upload/policy";
import { useIntegrationText } from "../../lib/integration-text";

const TEXTS = { "contentModel.integration.upload.videoHint": ["视频最长 {{minutes}} 分钟，原文件最大 {{size}} MB。上传后自动压缩为 MP4。", "Videos: up to {{minutes}} minutes and {{size}} MB. Compressed to MP4 after upload."] } as const;
export function VideoUploadHint({ className }: { className?: string }) {
  const tx = useIntegrationText(TEXTS);
  return <Text as="p" variant="bodyXs" tone="subdued" className={className}>{tx("contentModel.integration.upload.videoHint", { minutes: VIDEO_MAX_DURATION_SECONDS / 60, size: UPLOAD_SOURCE_MAX_MB.video })}</Text>;
}
