import { createClient } from "@/lib/supabase/client";
import {
  UploadFile,
  UploadResult,
  LocationData,
  GPSSource,
  AnchorData,
} from "./types";
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
          ).toFixed(2)}KB`
        );
      } catch (error) {
        console.error("文件处理失败:", error);
        throw new Error(`文件压缩失败: ${error}`);
      }
    }

    // 验证处理后的文件大小
    if (!validateFileSize(processedFile, config.maxSize)) {
      throw new Error(`文件大小超过限制 (${config.maxSize}MB)`);
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
    console.log(
      `开始上传文件到 Storage，大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    );

    // Supabase Storage 限制检查（实际配置为 1MB）
    const maxStorageSize = 1 * 1024 * 1024; // 1MB in bytes
    if (file.size > maxStorageSize) {
      throw new Error(
        `文件大小 ${(file.size / 1024 / 1024).toFixed(
          2
        )}MB 超过 Supabase Storage 限制 (1MB)。请联系管理员。`
      );
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await this.supabase.storage
      .from("assets")
      .upload(filePath, file);

    if (error) {
      console.error("Storage 上传错误:", error);
      throw error;
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from("assets").getPublicUrl(filePath);

    console.log(`文件上传成功: ${publicUrl}`);
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
      workspace_id: [workspaceId],
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
      workspace_id: [workspaceId],
      created_by: userId,
      file_type: "link",
      file_url: link,
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
      workspace_id: [workspaceId],
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

  /**
   * 保存锚点
   * 锚点必须有位置信息，可选文本内容
   */
  async saveAnchor(
    workspaceId: string,
    userId: string,
    anchorData: AnchorData
  ): Promise<void> {
    const { name, location, text } = anchorData;
    const geometry = `POINT(${location.longitude} ${location.latitude})`;

    const { error } = await this.supabase.from("asset").insert({
      workspace_id: [workspaceId],
      created_by: userId,
      name: name,
      file_type: "anchor",
      text_content: text || null,
      location: geometry,
      metadata: {
        longitude: location.longitude,
        latitude: location.latitude,
        height: location.height,
        upload_time: new Date().toISOString(),
      },
    });

    if (error) throw error;
  }
}
