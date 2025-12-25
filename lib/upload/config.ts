import { FileTypeConfig, UploadType } from "./types";
import {
  ImageIcon,
  Video,
  Music,
  FileText,
  Link as LinkIcon,
  File,
  Anchor,
} from "lucide-react";
import { compressToWebP } from "@/lib/image-compression";
import { extractGPSFromImage } from "@/lib/exif-reader";
import {
  compressToOpusWebM,
  extractAudioMetadata,
} from "@/lib/audio-compression";

/**
 * 文件类型配置
 */
export const FILE_TYPE_CONFIGS: Record<UploadType, FileTypeConfig> = {
  image: {
    type: "image",
    label: "图片",
    icon: ImageIcon,
    accept: "image/*",
    maxSize: 10,
    process: compressToWebP,
    extractMetadata: async (file: File) => {
      const gps = await extractGPSFromImage(file);
      return {
        gps,
        dimensions: await getImageDimensions(file),
      };
    },
  },
  video: {
    type: "video",
    label: "视频",
    icon: Video,
    accept: "video/*",
    maxSize: 100,
  },
  audio: {
    type: "audio",
    label: "音频",
    icon: Music,
    accept: "audio/*",
    maxSize: 50,
    process: compressToOpusWebM,
    extractMetadata: extractAudioMetadata,
  },
  document: {
    type: "document",
    label: "文档",
    icon: File,
    accept: ".pdf,.doc,.docx,.txt,.md",
    maxSize: 20,
  },
  link: {
    type: "link",
    label: "链接",
    icon: LinkIcon,
    accept: "",
  },
  text: {
    type: "text",
    label: "文本",
    icon: FileText,
    accept: "",
  },
  anchor: {
    type: "anchor",
    label: "锚点",
    icon: Anchor,
    accept: "",
  },
};

/**
 * 获取图片尺寸
 */
async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * 根据 MIME 类型推断上传类型
 */
export function inferUploadType(mimeType: string): UploadType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text/")
  ) {
    return "document";
  }
  return "document";
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File, maxSizeMB?: number): boolean {
  if (!maxSizeMB) return true;
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}
