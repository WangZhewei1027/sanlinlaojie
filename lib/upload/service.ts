import {
  FILE_TYPE_CONFIGS,
  getEffectiveMaxSizeMB,
  inferUploadType,
  validateFileSize,
} from "./config";
import type {
  GPSSource,
  UploadFile,
  UploadType
} from "./types";

/**
 * 文件上传服务
 */
export class FileUploadService {

  /**
   * 校验原始文件并提取采集坐标；媒体压缩由上传接口完成。
   */
  async processFile(file: File, requestedType?: UploadType): Promise<UploadFile> {
    const uploadType = requestedType ?? inferUploadType(file.type, file.name);
    const config = FILE_TYPE_CONFIGS[uploadType];
    if (uploadType === "anchor" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("匹配图仅支持 JPEG、PNG 和 WebP");
    }

    const maxSizeMB = getEffectiveMaxSizeMB(uploadType);
    if (file.size === 0 || !validateFileSize(file, maxSizeMB)) {
      throw new Error(`文件必须非空且不超过 ${maxSizeMB}MB`);
    }

    let gpsSource: GPSSource | undefined;

    // 保留原图采集坐标；服务端压缩会移除 EXIF。
    if (config.extractMetadata) {
      try {
        const metadata = await config.extractMetadata(file);
        if (metadata.gps) {
          gpsSource = {
            type: "exif",
            location: {
              latitude: metadata.gps.latitude,
              longitude: metadata.gps.longitude,
              height: metadata.gps.altitude || 0,
            },
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.warn("元数据提取失败:", error);
      }
    }

    return {
      file,
      type: uploadType,
      gpsSource,
    };
  }
}
