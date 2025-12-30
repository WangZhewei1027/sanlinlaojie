/**
 * 图片压缩模块
 *
 * 功能：将图片压缩为 WebP 格式
 *
 * 压缩策略：
 * - 分辨率固定在 1920px，不降低
 * - 在已压缩的结果基础上继续压缩（迭代压缩）
 * - 通过逐步降低质量来减小文件大小
 */

import imageCompression from "browser-image-compression";

// ==================== 配置常量 ====================

/** 压缩配置 */
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1920, // 固定最大分辨率（长边）
  fileType: "image/webp" as const, // 输出格式
  useWebWorker: true, // 使用 Web Worker 提升性能
  initialQuality: 0.8, // 默认初始质量
};

/** 最小压缩质量 */
const MIN_QUALITY = 0.1;

/** 质量降低步长 */
const QUALITY_STEP = 0.2;

/** 最大压缩尝试次数 */
const MAX_COMPRESSION_ATTEMPTS = 8;

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
async function performCompression(
  file: File,
  quality: number
): Promise<Blob> {
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
 * @param maxSizeMB - 最大文件大小（MB），默认 0.9MB
 * @returns 压缩后的 WebP 文件
 *
 * @remarks
 * - 分辨率固定在 1920px
 * - 在压缩结果的基础上继续压缩（迭代压缩）
 * - 逐步降低质量直到达到目标大小或最低质量
 */
export async function compressToWebP(
  file: File,
  maxSizeMB: number = 0.25
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
  let currentFile: File = file;
  let attempt = 0;

  try {
    // 步骤 3: 迭代压缩直到满足大小要求或达到最大尝试次数
    while (attempt < MAX_COMPRESSION_ATTEMPTS) {
      attempt++;

      // 在当前文件基础上继续压缩
      const compressed = await performCompression(currentFile, currentQuality);

      console.log(
        `第 ${attempt} 次压缩: ${formatSizeMB(compressed.size)}MB (质量=${currentQuality.toFixed(2)})`
      );

      // 更新当前文件为压缩结果
      currentFile = new File([compressed], file.name, {
        type: compressed.type,
      });

      // 检查是否满足大小要求
      if (currentFile.size <= targetSizeBytes) {
        console.log(`✓ 达到目标大小`);
        break;
      }

      // 检查是否已达最低质量
      if (currentQuality <= MIN_QUALITY) {
        console.warn(
          `⚠ 已达到最低质量 (${MIN_QUALITY})，但文件仍为 ${formatSizeMB(currentFile.size)}MB`
        );
        break;
      }

      // 降低质量准备下次压缩
      currentQuality = Math.max(currentQuality - QUALITY_STEP, MIN_QUALITY);
      console.log(`降低质量至 ${currentQuality.toFixed(2)}，继续压缩...`);
    }

    if (attempt >= MAX_COMPRESSION_ATTEMPTS && currentFile.size > targetSizeBytes) {
      console.warn(
        `⚠ 已达到最大尝试次数 (${MAX_COMPRESSION_ATTEMPTS})，最终大小: ${formatSizeMB(currentFile.size)}MB`
      );
    }
  } catch (error) {
    // 步骤 4: 压缩失败时的降级策略
    console.error("压缩失败，尝试使用保守配置:", error);

    // 使用更保守的配置：禁用 Web Worker
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1920,
      fileType: "image/webp",
      initialQuality: 0.5,
      useWebWorker: false,
    });

    currentFile = new File([compressed], file.name, {
      type: compressed.type,
    });
  }

  // 步骤 5: 创建最终文件
  const originalFileName = file.name.split(".")[0];
  const compressedFile = new File([currentFile], `${originalFileName}.webp`, {
    type: "image/webp",
  });

  console.log(
    `✓ 压缩完成: ${formatSizeMB(file.size)}MB → ${formatSizeMB(compressedFile.size)}MB`
  );

  return compressedFile;
}
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
