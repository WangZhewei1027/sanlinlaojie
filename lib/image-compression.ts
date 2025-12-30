/**
 * 图片压缩模块
 *
 * 功能：将图片压缩为 WebP 格式，目标大小为 200KB
 *
 * iOS Safari 兼容性说明：
 * - 避免多次迭代压缩，防止分辨率指数级下降
 * - 通过预估初始质量，减少压缩次数
 * - 始终从原始文件重新压缩，而非对已压缩文件再次压缩
 */

import imageCompression from "browser-image-compression";

// ==================== 配置常量 ====================

/** 压缩配置 */
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1920, // 限制最大分辨率（长边）
  fileType: "image/webp" as const, // 输出格式
  maxSizeMB: 0.2, // 目标大小 200KB
  useWebWorker: true, // 使用 Web Worker 提升性能
  initialQuality: 0.8, // 默认初始质量
};

/** 最小压缩质量 */
const MIN_QUALITY = 0.3;

/** 质量降低步长 */
const QUALITY_STEP = 0.15;

/** 最大压缩尝试次数 */
const MAX_COMPRESSION_ATTEMPTS = 5;

// ==================== 辅助函数 ====================

/**
 * 根据文件大小估算合适的初始压缩质量
 * 文件越大，使用越低的初始质量
 */
function estimateInitialQuality(fileSizeBytes: number): number {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  if (fileSizeMB > 5) return 0.6;
  if (fileSizeMB > 2) return 0.7;
  if (fileSizeMB > 1) return 0.75;
  return 0.8;
}

/**
 * 格式化文件大小为 KB
 */
function formatSizeKB(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

/**
 * 格式化文件大小为 MB
 */
function formatSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

/**
 * 执行图片压缩
 */
async function performCompression(file: File, quality: number): Promise<Blob> {
  return await imageCompression(file, {
    ...COMPRESSION_OPTIONS,
    initialQuality: quality,
  });
}

// ==================== 主函数 ====================

/**
 * 将图片压缩为 WebP 格式
 *
 * @param file - 原始图片文件
 * @param maxSizeMB - 最大文件大小（MB），默认 0.2MB (200KB)
 * @returns 压缩后的 WebP 文件
 *
 * @remarks
 * - 如果文件已小于目标大小，直接返回
 * - 先将分辨率限制到 1920px，再通过质量控制文件大小
 * - 多次尝试压缩，均从原始文件压缩（避免 iOS Safari 分辨率下降）
 * - 如果超过最大尝试次数仍未达标，返回最佳结果
 */
export async function compressToWebP(
  file: File,
  maxSizeMB: number = 0.2
): Promise<File> {
  const targetSizeBytes = maxSizeMB * 1024 * 1024;

  // 步骤 1: 检查是否需要压缩
  if (file.size <= targetSizeBytes) {
    console.log(
      `文件已小于 ${maxSizeMB}MB (${formatSizeKB(file.size)}KB)，跳过压缩`
    );
    return file;
  }

  console.log(`开始压缩: ${formatSizeMB(file.size)}MB，目标: ${maxSizeMB}MB`);

  // 步骤 2: 根据原始文件大小估算初始质量
  let currentQuality = estimateInitialQuality(file.size);
  let compressed: Blob | null = null;
  let attempt = 0;

  try {
    // 步骤 3: 迭代压缩直到满足大小要求或达到最大尝试次数
    while (attempt < MAX_COMPRESSION_ATTEMPTS) {
      attempt++;

      // 重要：始终从原始文件压缩，而非压缩已压缩的文件
      compressed = await performCompression(file, currentQuality);

      console.log(
        `第 ${attempt} 次压缩: ${formatSizeMB(
          compressed.size
        )}MB (质量=${currentQuality.toFixed(2)})`
      );

      // 检查是否满足大小要求
      if (compressed.size <= targetSizeBytes) {
        console.log(`✓ 达到目标大小`);
        break;
      }

      // 检查是否已达最低质量
      if (currentQuality <= MIN_QUALITY) {
        console.warn(
          `⚠ 已达到最低质量 (${MIN_QUALITY})，但文件仍为 ${formatSizeMB(
            compressed.size
          )}MB`
        );
        break;
      }

      // 降低质量准备下次压缩
      const nextQuality = Math.max(currentQuality - QUALITY_STEP, MIN_QUALITY);
      console.log(
        `文件仍然较大 (${formatSizeMB(
          compressed.size
        )}MB > ${maxSizeMB}MB)，降低质量至 ${nextQuality.toFixed(2)}`
      );
      currentQuality = nextQuality;
    }

    if (
      attempt >= MAX_COMPRESSION_ATTEMPTS &&
      compressed!.size > targetSizeBytes
    ) {
      console.warn(
        `⚠ 已达到最大尝试次数 (${MAX_COMPRESSION_ATTEMPTS})，使用当前最佳结果`
      );
    }
  } catch (error) {
    // 步骤 4: 压缩失败时的降级策略
    console.error("压缩失败，尝试使用保守配置:", error);

    // 使用更保守的配置：禁用 Web Worker（iOS 兼容性）
    compressed = await imageCompression(file, {
      maxWidthOrHeight: 1920,
      fileType: "image/webp",
      initialQuality: 0.5,
      useWebWorker: false,
    });
  }

  // 步骤 5: 创建最终文件
  const originalFileName = file.name.split(".")[0];
  const compressedFile = new File([compressed!], `${originalFileName}.webp`, {
    type: "image/webp",
  });

  console.log(
    `✓ 压缩完成: ${formatSizeMB(file.size)}MB → ${formatSizeMB(
      compressedFile.size
    )}MB`
  );

  return compressedFile;
}
