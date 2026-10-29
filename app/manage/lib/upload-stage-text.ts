"use client";
import type { UploadStage } from "@/lib/upload/progress";
import { useIntegrationText } from "./integration-text";

const TEXTS = {
  "contentModel.integration.upload.preparing": ["正在检查文件…", "Checking file…"],
  "contentModel.integration.upload.uploading": ["正在上传原文件…", "Uploading original file…"],
  "contentModel.integration.upload.compressingImage": ["正在服务端压缩图片…", "Compressing image on server…"],
  "contentModel.integration.upload.compressingAudio": ["正在服务端压缩音频…", "Compressing audio on server…"],
  "contentModel.integration.upload.compressingVideo": ["正在服务端压缩视频…", "Compressing video on server…"],
  "contentModel.integration.upload.storing": ["正在保存文件…", "Saving file…"],
  "contentModel.integration.upload.creating": ["正在保存素材…", "Saving asset…"],
} as const;

export function useUploadStageText() {
  const tx = useIntegrationText(TEXTS);
  return (stage: UploadStage) => tx(`contentModel.integration.upload.${stage}`);
}
