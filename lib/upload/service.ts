import {
  FILE_TYPE_CONFIGS,
  getEffectiveMaxSizeMB,
  inferUploadType,
  validateFileSize,
} from "./config";
import {
  GPSSource,
  UploadFile,
  UploadType
} from "./types";

/**
 * 文件上传服务
 */
export class FileUploadService {

  /**
   * 处理文件（压缩、提取元数据等）
   */
  async processFile(file: File, requestedType?: UploadType): Promise<UploadFile> {
    const uploadType = requestedType ?? inferUploadType(file.type, file.name);
    const config = FILE_TYPE_CONFIGS[uploadType];
    if (uploadType === "anchor" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("匹配图仅支持 JPEG、PNG 和 WebP");
    }

    let processedFile = file;
    let gpsSource: GPSSource | undefined;

    // 提取元数据（如 GPS）- 在压缩前提取，避免 EXIF 数据丢失
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

    // 处理文件（如压缩）
    if (config.process) {
      try {
        processedFile = await config.process(file);
        console.log(
          `文件处理完成: ${(file.size / 1024).toFixed(2)}KB -> ${(
            processedFile.size / 1024
          ).toFixed(2)}KB`,
        );
      } catch (error) {
        console.error("文件处理失败:", error);
        throw new Error(`文件压缩失败: ${error}`);
      }
    }

    // 验证处理后的文件大小（类型配置与存储桶硬上限取较小值）
    const maxSizeMB = getEffectiveMaxSizeMB(uploadType);
    if (!validateFileSize(processedFile, maxSizeMB)) {
      throw new Error(`文件大小超过限制 (${maxSizeMB}MB)`);
    }

    return {
      file: processedFile,
      type: uploadType,
      gpsSource,
    };
  }
}
