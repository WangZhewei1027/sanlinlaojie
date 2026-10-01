import {
  UploadFile,
  UploadResult,
  UploadType,
  LocationData,
  GPSSource,
  AnchorData,
  UploadedAsset,
} from "./types";
import {
  FILE_TYPE_CONFIGS,
  getEffectiveMaxSizeMB,
  inferUploadType,
  validateFileSize,
} from "./config";
import type { LinkAssetData } from "@/lib/link-asset";

/**
 * uploadToStorage 的返回：storagePath 仅在本次真正上传了新对象时非 null；
 * 去重命中复用已有对象时为 null——调用方绝不能对复用对象做补偿删除。
 */
export interface StorageUploadResult {
  url: string;
  contentHash: string;
  storagePath: string | null;
}

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

  /**
   * 上传文件到对象存储（经 /api/upload 中转到 OSS，服务端按内容 hash 做组织内去重）。
   * 相同内容的文件命中同组织已有 file_url 时服务端直接复用、不再写入新对象。
   * @param options.type 上传类型（用于大小校验；缺省按 MIME/扩展名推断）
   * @param options.workspaceId 目标 workspace，用于组织内去重；缺省则跳过去重
   * @returns 文件公开 URL、内容 hash，以及新上传对象的 key（复用时为 null）
   */
  async uploadToStorage(
    file: File,
    userId: string,
    options?: { type?: UploadType; workspaceId?: string },
  ): Promise<StorageUploadResult> {
    void userId; // 上传归属由服务端根据会话决定
    console.log(
      `开始上传文件，大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );

    // 大小上限以类型配置为唯一事实来源（已含存储 5MB 硬上限约束）
    const uploadType = options?.type ?? inferUploadType(file.type, file.name);
    const maxSizeMB = getEffectiveMaxSizeMB(uploadType);
    if (!validateFileSize(file, maxSizeMB)) {
      throw new Error(
        `文件大小 ${(file.size / 1024 / 1024).toFixed(
          2,
        )}MB 超过限制 (${maxSizeMB}MB)`,
      );
    }

    const form = new FormData();
    form.set("file", file, file.name);
    form.set("type", uploadType);
    if (options?.workspaceId) form.set("workspace_id", options.workspaceId);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as {
      url?: string;
      contentHash?: string;
      storagePath?: string | null;
      error?: string;
    };
    if (!res.ok || !body.url || !body.contentHash) {
      console.error("上传错误:", body.error);
      throw new Error(body.error || "上传失败");
    }

    if (body.storagePath === null) {
      console.log(`命中已有文件，复用 URL（跳过上传）: ${body.url}`);
    } else {
      console.log(`文件上传成功: ${body.url}`);
    }
    return {
      url: body.url,
      contentHash: body.contentHash,
      storagePath: body.storagePath ?? null,
    };
  }

  /**
   * 补偿清理：后续 DB 写入失败时删除刚上传的存储对象，避免孤儿文件。
   * 仅当本次确实上传了新对象（storagePath 非 null）才尝试删除；去重复用的
   * 已有对象绝不能删。服务端删除前对 file_url 与 metadata.checkin_url 做引用
   * 计数（并发去重命中可能已让新行引用该对象），仍被引用则保留。
   * 尽力而为：任何失败都吞掉、不掩盖原始错误——残留孤儿文件由
   * /api/admin/clean 的全局清扫兜底回收。
   */
  async cleanupUploadedFile(upload: {
    url: string;
    storagePath: string | null;
  }): Promise<void> {
    if (!upload.storagePath) return;
    try {
      await fetch(`/api/upload?key=${encodeURIComponent(upload.storagePath)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("补偿删除存储对象失败（将由全局清扫回收）:", err);
    }
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
    const { name, location, text, fileUrl, contentHash } = anchorData;
    const geometry = `POINT(${location.longitude} ${location.latitude})`;

    return this.createAsset(workspaceId, {
      name: name,
      file_type: "anchor",
      file_url: fileUrl,
      content_hash: contentHash,
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
