import { FileTypeConfig, UploadType } from "./types";
import {
  ImageIcon,
  Video,
  Music,
  FileText,
  Link as LinkIcon,
  File,
  Anchor,
  ShoppingBag,
  Box,
} from "lucide-react";
import { compressImage } from "@/lib/image-compression";
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
    label: "fileTypes.image",
    icon: ImageIcon,
    accept: "image/*",
    maxSize: 10,
    process: (file: File) => compressImage(file, 0.2),
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
    label: "fileTypes.video",
    icon: Video,
    accept: "video/*",
    maxSize: 100,
  },
  audio: {
    type: "audio",
    label: "fileTypes.audio",
    icon: Music,
    accept: "audio/*",
    maxSize: 50,
    process: compressToOpusWebM,
    extractMetadata: extractAudioMetadata,
  },
  document: {
    type: "document",
    label: "fileTypes.document",
    icon: File,
    accept: ".pdf,.doc,.docx,.txt,.md",
    maxSize: 20,
  },
  link: {
    type: "link",
    label: "fileTypes.link",
    icon: LinkIcon,
    accept: "",
  },
  text: {
    type: "text",
    label: "fileTypes.text",
    icon: FileText,
    accept: "",
  },
  anchor: {
    type: "anchor",
    label: "fileTypes.anchor",
    icon: Anchor,
    accept: "",
  },
  shop: {
    type: "shop",
    label: "fileTypes.shop",
    icon: ShoppingBag,
    accept: "image/*",
    maxSize: 10,
    process: (file: File) => compressImage(file, 0.2),
    extractMetadata: async (file: File) => {
      const gps = await extractGPSFromImage(file);
      return {
        gps,
        dimensions: await getImageDimensions(file),
      };
    },
  },
  model: {
    type: "model",
    label: "fileTypes.model",
    icon: Box,
    accept: ".gltf,.glb",
    maxSize: 3,
  },
};

/**
 * 获取图片尺寸
 */
async function getImageDimensions(
  file: File,
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
    mimeType === "model/gltf+json" ||
    mimeType === "model/gltf-binary"
  )
    return "model";
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
