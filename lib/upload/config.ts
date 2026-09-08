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

// 定义移至 ./types（纯模块，服务端路由可安全导入），此处再导出以兼容现有引用
export { DEFAULT_UPLOAD_TYPES } from "./types";

/**
 * 文件类型配置
 */
export const FILE_TYPE_CONFIGS: Record<UploadType, FileTypeConfig> = {
  image: {
    type: "image",
    label: "fileTypes.image",
    icon: ImageIcon,
    accept: "image/*",
    maxSize: 5,
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
    accept:
      "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/3gpp,.mp4,.mov,.webm,.avi,.mkv,.3gp",
    maxSize: 3,
  },
  audio: {
    type: "audio",
    label: "fileTypes.audio",
    icon: Music,
    accept: "audio/*",
    maxSize: 3,
    // TODO: 暂时跳过压缩，待压缩模块稳定后恢复
    // process: compressToOpusWebM,
    extractMetadata: extractAudioMetadata,
  },
  document: {
    type: "document",
    label: "fileTypes.document",
    icon: File,
    accept: ".pdf,.doc,.docx,.txt,.md",
    maxSize: 5,
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
    accept: "image/jpeg,image/png,image/webp",
    maxSize: 4,
    process: (file: File) => compressImage(file, 1),
    extractMetadata: async (file: File) => ({ gps: await extractGPSFromImage(file) }),
  },
  shop: {
    type: "shop",
    label: "fileTypes.shop",
    icon: ShoppingBag,
    accept: "image/*",
    maxSize: 5,
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
 * assets 存储桶的单文件硬上限（Supabase bucket file_size_limit = 5 MiB）。
 * 各类型的 maxSize 配置不得超过此值，否则文件会在校验通过后于上传阶段被拒。
 */
export const STORAGE_MAX_FILE_SIZE_MB = 5;

/**
 * 某类型的有效大小上限（MB）：类型配置与存储桶硬上限取较小值。
 * 大小校验的唯一入口，配置值即各类型的单一事实来源。
 */
export function getEffectiveMaxSizeMB(type: UploadType): number {
  const configured = FILE_TYPE_CONFIGS[type].maxSize;
  return configured
    ? Math.min(configured, STORAGE_MAX_FILE_SIZE_MB)
    : STORAGE_MAX_FILE_SIZE_MB;
}

/**
 * 扩展名 → 上传类型映射。
 * 常见 image/audio 扩展名兜底在前，FILE_TYPE_CONFIGS 中 accept 声明的
 * 扩展名（video/document/model 等）在后覆盖——配置为准。
 */
const EXTENSION_TYPE_MAP: Record<string, UploadType> = (() => {
  const map: Record<string, UploadType> = {};
  const sanityFallback: Record<string, UploadType> = {
    jpg: "image",
    jpeg: "image",
    png: "image",
    gif: "image",
    webp: "image",
    bmp: "image",
    heic: "image",
    heif: "image",
    mp3: "audio",
    wav: "audio",
    m4a: "audio",
    aac: "audio",
    ogg: "audio",
    oga: "audio",
    opus: "audio",
    flac: "audio",
  };
  Object.assign(map, sanityFallback);
  for (const config of Object.values(FILE_TYPE_CONFIGS)) {
    for (const token of config.accept.split(",")) {
      const trimmed = token.trim().toLowerCase();
      if (trimmed.startsWith(".")) {
        map[trimmed.slice(1)] = config.type;
      }
    }
  }
  return map;
})();

/**
 * 根据 MIME 类型推断上传类型；MIME 不可靠时按文件扩展名兜底。
 * .glb/.gltf 等常以 application/octet-stream 到达，仅靠 MIME 会误判为 document。
 */
export function inferUploadType(mimeType: string, fileName?: string): UploadType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "model/gltf+json" || mimeType === "model/gltf-binary")
    return "model";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text/")
  ) {
    return "document";
  }
  // MIME 未命中：按扩展名兜底（来源于 FILE_TYPE_CONFIGS 的 accept + 常见扩展名）
  if (fileName && fileName.includes(".")) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && EXTENSION_TYPE_MAP[ext]) return EXTENSION_TYPE_MAP[ext];
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
