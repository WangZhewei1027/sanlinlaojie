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
  | "text";

export interface UploadFile {
  file: File;
  type: UploadType;
  gpsSource?: GPSSource;
}

export interface UploadResult {
  fileUrl?: string;
  fileType: UploadType;
  location?: LocationData;
  gpsSource?: GPSSource["type"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
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
