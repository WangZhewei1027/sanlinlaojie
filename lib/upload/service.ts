import { createClient } from "@/lib/supabase/client";
import { UploadFile, UploadResult, LocationData, GPSSource } from "./types";
import { FILE_TYPE_CONFIGS, inferUploadType, validateFileSize } from "./config";

/**
 * 文件上传服务
 */
export class FileUploadService {
  private supabase = createClient();

  /**
   * 处理文件（压缩、提取元数据等）
   */
  async processFile(file: File): Promise<UploadFile> {
    const uploadType = inferUploadType(file.type);
    const config = FILE_TYPE_CONFIGS[uploadType];

    // 验证文件大小
    if (!validateFileSize(file, config.maxSize)) {
      throw new Error(`文件大小超过限制 (${config.maxSize}MB)`);
    }

    let processedFile = file;
    let gpsSource: GPSSource | undefined;

    // 处理文件（如压缩）
    if (config.process) {
      try {
        processedFile = await config.process(file);
        console.log(
          `文件处理完成: ${(file.size / 1024).toFixed(2)}KB -> ${(
            processedFile.size / 1024
          ).toFixed(2)}KB`
        );
      } catch (error) {
        console.warn("文件处理失败，使用原文件:", error);
      }
    }

    // 提取元数据（如 GPS）
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
      file: processedFile,
      type: uploadType,
      gpsSource,
    };
  }

  /**
   * 上传文件到 Storage
   */
  async uploadToStorage(file: File, userId: string): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await this.supabase.storage
      .from("assets")
      .upload(filePath, file);

    if (error) throw error;

    const {
      data: { publicUrl },
    } = this.supabase.storage.from("assets").getPublicUrl(filePath);

    return publicUrl;
  }

  /**
   * 保存到数据库
   */
  async saveToDatabase(
    workspaceId: string,
    userId: string,
    result: UploadResult
  ): Promise<void> {
    const geometry = result.location
      ? `POINT(${result.location.longitude} ${result.location.latitude})`
      : null;

    const { error } = await this.supabase.from("asset").insert({
      workspace_id: workspaceId,
      created_by: userId,
      file_type: result.fileType,
      file_url: result.fileUrl,
      location: geometry,
      metadata: {
        longitude: result.location?.longitude,
        latitude: result.location?.latitude,
        height: result.location?.height,
        upload_time: new Date().toISOString(),
        gps_source: result.gpsSource,
        ...result.metadata,
      },
    });

    if (error) throw error;
  }

  /**
   * 保存链接
   */
  async saveLink(
    workspaceId: string,
    userId: string,
    link: string,
    location?: LocationData
  ): Promise<void> {
    const geometry = location
      ? `POINT(${location.longitude} ${location.latitude})`
      : null;

    const { error } = await this.supabase.from("asset").insert({
      workspace_id: workspaceId,
      created_by: userId,
      file_type: "link",
      link,
      location: geometry,
      metadata: {
        longitude: location?.longitude,
        latitude: location?.latitude,
        height: location?.height,
        upload_time: new Date().toISOString(),
      },
    });

    if (error) throw error;
  }

  /**
   * 保存文本
   */
  async saveText(
    workspaceId: string,
    userId: string,
    text: string,
    location?: LocationData
  ): Promise<void> {
    const geometry = location
      ? `POINT(${location.longitude} ${location.latitude})`
      : null;

    const { error } = await this.supabase.from("asset").insert({
      workspace_id: workspaceId,
      created_by: userId,
      file_type: "text",
      text_content: text,
      location: geometry,
      metadata: {
        longitude: location?.longitude,
        latitude: location?.latitude,
        height: location?.height,
        upload_time: new Date().toISOString(),
      },
    });

    if (error) throw error;
  }
}
