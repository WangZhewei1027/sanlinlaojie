import { createClient } from "@/lib/supabase/client";
import {
  UploadFile,
  UploadResult,
  LocationData,
  GPSSource,
  AnchorData,
  UploadedAsset,
} from "./types";
import { FILE_TYPE_CONFIGS, inferUploadType, validateFileSize } from "./config";
import type { LinkAssetData } from "@/lib/link-asset";

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
          ).toFixed(2)}KB`,
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
   * 计算文件内容的 SHA-256（十六进制），用于全局去重。
   */
  async computeContentHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * 按内容 hash 查是否已有相同文件（全局），命中则返回其 file_url。
   */
  private async findExistingByHash(hash: string): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/assets/by-hash?hash=${encodeURIComponent(hash)}`,
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { file_url?: string | null };
      return body.file_url ?? null;
    } catch (err) {
      console.warn("by-hash 查询失败，回退为正常上传:", err);
      return null;
    }
  }

  /**
   * 上传文件到 Storage（带内容 hash 全局去重）。
   * 相同内容的文件命中已有 file_url 时直接复用、跳过上传。
   * @returns 文件的公开 URL 与内容 hash
   */
  async uploadToStorage(
    file: File,
    userId: string,
  ): Promise<{ url: string; contentHash: string }> {
    console.log(
      `开始上传文件到 Storage，大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );

    // Supabase Storage 限制检查（实际配置为 1MB）
    const maxStorageSize = 5 * 1024 * 1024; // 1MB in bytes
    if (file.size > maxStorageSize) {
      throw new Error(
        `文件大小 ${(file.size / 1024 / 1024).toFixed(
          2,
        )}MB 超过 Supabase Storage 限制 (5MB)。请联系管理员。`,
      );
    }

    // 计算内容 hash，命中已有文件则复用，避免相同素材重复存储
    const contentHash = await this.computeContentHash(file);
    const existingUrl = await this.findExistingByHash(contentHash);
    if (existingUrl) {
      console.log(`命中已有文件，复用 URL（跳过上传）: ${existingUrl}`);
      return { url: existingUrl, contentHash };
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
    return { url: publicUrl, contentHash };
  }

  /**
   * 通过服务端路由创建资产（带 org.assets.write 鉴权；viewer 被拒）。
   * workspace_id / created_by 由服务端根据会话决定，客户端不再直连插入。
   * 返回服务端创建的完整行，供调用方本地更新列表而无需重新拉取。
   */
  private async createAsset(
    workspaceId: string,
    payload: Record<string, unknown>,
  ): Promise<UploadedAsset> {
    const res = await fetch(`/api/workspaces/${workspaceId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        (body as { error?: string }).error || "创建资源失败",
      );
    }

    return (body as { data: UploadedAsset }).data;
  }

  /**
   * 保存到数据库
   */
  async saveToDatabase(
    workspaceId: string,
    userId: string,
    result: UploadResult,
  ): Promise<UploadedAsset> {
    const geometry = result.location
      ? `POINT(${result.location.longitude} ${result.location.latitude})`
      : null;

    return this.createAsset(workspaceId, {
      name: result.name || null,
      file_type: result.fileType,
      file_url: result.fileUrl,
      content_hash: result.contentHash || null,
      text_content: result.textContent || null,
      location: geometry,
      tag_ids: result.tagIds && result.tagIds.length > 0 ? result.tagIds : null,
      metadata: {
        longitude: result.location?.longitude,
        latitude: result.location?.latitude,
        height: result.location?.height,
        upload_time: new Date().toISOString(),
        gps_source: result.gpsSource,
        ...(result.checkinUrl ? { checkin_url: result.checkinUrl } : {}),
        ...result.metadata,
      },
    });
  }

  /**
   * 保存链接
   */
  async saveLink(
    workspaceId: string,
    userId: string,
    link: LinkAssetData,
    location?: LocationData,
  ): Promise<UploadedAsset> {
    const geometry = location
      ? `POINT(${location.longitude} ${location.latitude})`
      : null;

    return this.createAsset(workspaceId, {
      file_type: "link",
      file_url: link.previewUrl,
      config: { link },
      location: geometry,
      metadata: {
        longitude: location?.longitude,
        latitude: location?.latitude,
        height: location?.height,
        upload_time: new Date().toISOString(),
      },
    });
  }

  /**
   * 保存文本
   */
  async saveText(
    workspaceId: string,
    userId: string,
    text: string,
    location?: LocationData,
    tagIds?: string[],
  ): Promise<UploadedAsset> {
    const geometry = location
      ? `POINT(${location.longitude} ${location.latitude})`
      : null;

    return this.createAsset(workspaceId, {
      file_type: "text",
      text_content: text,
      location: geometry,
      tag_ids: tagIds && tagIds.length > 0 ? tagIds : null,
      metadata: {
        longitude: location?.longitude,
        latitude: location?.latitude,
        height: location?.height,
        upload_time: new Date().toISOString(),
      },
    });
  }

  /**
   * 保存锚点
   * 锚点必须有位置信息，可选文本内容
   */
  async saveAnchor(
    workspaceId: string,
    userId: string,
    anchorData: AnchorData,
  ): Promise<UploadedAsset> {
    const { name, location, text } = anchorData;
    const geometry = `POINT(${location.longitude} ${location.latitude})`;

    return this.createAsset(workspaceId, {
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
  }
}
