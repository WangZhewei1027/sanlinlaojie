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

/** 目标文件大小（字节） */
const TARGET_SIZE_BYTES = 0.2 * 1024 * 1024; // 200KB

/** 跳过压缩的阈值（字节） */
const SKIP_COMPRESSION_THRESHOLD = TARGET_SIZE_BYTES;

/** 最小压缩质量 */
const MIN_QUALITY = 0.4;

/** 质量降低步长 */
const QUALITY_STEP = 0.2;

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
 * @returns 压缩后的 WebP 文件
 *
 * @remarks
 * - 如果文件已小于 200KB，直接返回
 * - 先将分辨率限制到 1920px，再通过质量控制文件大小
 * - 最多尝试两次压缩，均从原始文件压缩（避免 iOS Safari 分辨率下降）
 */
export async function compressToWebP(file: File): Promise<File> {
  // 步骤 1: 检查是否需要压缩
  if (file.size < SKIP_COMPRESSION_THRESHOLD) {
    console.log(
      `文件已小于 ${formatSizeKB(SKIP_COMPRESSION_THRESHOLD)}KB，跳过压缩`
    );
    return file;
  }

  console.log(`开始压缩: ${formatSizeKB(file.size)}KB`);

  // 步骤 2: 根据原始文件大小估算初始质量
  const initialQuality = estimateInitialQuality(file.size);

  let compressed: Blob;

  try {
    // 步骤 3: 第一次压缩（从原始文件）
    compressed = await performCompression(file, initialQuality);
    console.log(
      `第一次压缩: ${formatSizeKB(
        compressed.size
      )}KB (质量=${initialQuality.toFixed(2)})`
    );

    // 步骤 4: 如果仍然太大，使用更低质量再次压缩
    if (compressed.size > TARGET_SIZE_BYTES && initialQuality > MIN_QUALITY) {
      const lowerQuality = Math.max(initialQuality - QUALITY_STEP, MIN_QUALITY);

      console.log(
        `文件仍然较大，使用更低质量重新压缩原始文件 (质量=${lowerQuality.toFixed(
          2
        )})`
      );

      // 重要：从原始文件重新压缩，而非压缩已压缩的文件
      compressed = await performCompression(file, lowerQuality);
      console.log(`第二次压缩: ${formatSizeKB(compressed.size)}KB`);
    }
  } catch (error) {
    // 步骤 5: 压缩失败时的降级策略
    console.error("压缩失败，尝试使用保守配置:", error);

    // 使用更保守的配置：禁用 Web Worker（iOS 兼容性）
    compressed = await imageCompression(file, {
      maxWidthOrHeight: 1920,
      fileType: "image/webp",
      initialQuality: 0.7,
      useWebWorker: false,
    });
  }

  // 步骤 6: 创建最终文件
  const originalFileName = file.name.split(".")[0];
  const compressedFile = new File([compressed], `${originalFileName}.webp`, {
    type: "image/webp",
  });

  console.log(
    `✓ 压缩完成: ${formatSizeKB(file.size)}KB → ${formatSizeKB(
      compressedFile.size
    )}KB`
  );

  return compressedFile;
}
