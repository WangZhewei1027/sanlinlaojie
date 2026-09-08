/**
 * 上传相关的类型定义
 */

export interface LocationData {
  longitude: number;
  latitude: number;
  height: number;
}

export interface GPSSource {
  type: "exif" | "user_click" | "device_gps";
  location: LocationData;
  timestamp?: string;
}

export type UploadType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "link"
  | "text"
  | "anchor"
  | "shop"
  | "model";

/** 全部上传类型（服务端校验用；本模块无浏览器依赖，路由可安全导入） */
export const ALL_UPLOAD_TYPES: UploadType[] = [
  "image",
  "video",
  "audio",
  "document",
  "link",
  "text",
  "anchor",
  "shop",
  "model",
];

/**
 * organization.allowed_file_types 为 null 时生效的兜底集合。
 * 注意：不含 document / model —— 这两类需要组织显式开启。
 * 新组织的默认集合以 app_config.default_allowed_file_types 为准
 * （super-admin 系统设置可改），此常量仅兜历史 null 数据和配置缺失。
 */
export const DEFAULT_UPLOAD_TYPES: UploadType[] = [
  "image",
  "video",
  "audio",
  "link",
  "text",
  "anchor",
  "shop",
];

export interface UploadFile {
  file: File;
  type: UploadType;
  gpsSource?: GPSSource;
}

export interface UploadResult {
  fileUrl?: string;
  contentHash?: string;
  fileType: UploadType;
  location?: LocationData;
  gpsSource?: GPSSource["type"];
  tagIds?: string[];
  name?: string;
  textContent?: string;
  checkinUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface AnchorData {
  fileUrl: string;
  contentHash: string;
  name: string;
  text?: string;
  location: LocationData;
}

/**
 * 创建成功后服务端返回的 asset 表原始行（与列表接口返回的行同构）。
 * 只声明客户端已知的公共字段；app 侧可安全断言为其完整的 Asset 类型。
 */
export interface UploadedAsset {
  id: string;
  file_type: string;
  file_url: string | null;
  name?: string | null;
  text_content?: string | null;
  tag_ids?: string[] | null;
  created_by?: string | null;
  config?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface FileTypeConfig {
  type: UploadType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accept: string;
  maxSize?: number; // MB
  process?: (file: File) => Promise<File>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractMetadata?: (file: File) => Promise<Record<string, any>>;
}
