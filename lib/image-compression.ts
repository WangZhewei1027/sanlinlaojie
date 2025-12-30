/**
 * 图片压缩模块
 *
 * 功能：将图片压缩为 WebP 格式
 *
 * 压缩策略：
 * - 从原始文件压缩，先调整质量，质量无效时降低分辨率
 * - 分辨率范围：1920px → 1280px → 960px → 640px
 * - 通过质量和分辨率双重控制来达到目标大小
 */

import imageCompression from "browser-image-compression";

// ==================== 配置常量 ====================

/** 压缩配置 */
const COMPRESSION_OPTIONS = {
  fileType: "image/webp" as const, // 输出格式
  useWebWorker: true, // 使用 Web Worker 提升性能
  initialQuality: 0.8, // 默认初始质量
};

/** 最小压缩质量 */
const MIN_QUALITY = 0.3;

/** 质量降低步长 */
const QUALITY_STEP = 0.15;

/** 可用的分辨率档位（从高到低） */
const RESOLUTION_LEVELS = [1920, 1280, 960, 640];

/** 最大压缩尝试次数 */
const MAX_COMPRESSION_ATTEMPTS = 12;

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
  quality: number,
  maxWidthOrHeight: number
): Promise<Blob> {
  return await imageCompression(file, {
    ...COMPRESSION_OPTIONS,
    initialQuality: quality,
    maxWidthOrHeight,
  });
}

// ==================== 主函数 ====================

/**
 * 将图片压缩为 WebP 格式
 *
 * @p始终从原始文件压缩
 * - 先在当前分辨率下调整质量
 * - 质量达到最低后，降低分辨率并重置质量
 * - 分辨率档位：1920px → 1280px → 960px → 640px
 */
export async function compressToWebP(
  file: File,
  maxSizeMB: number = 0.9
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

  // 步骤 2: 初始化压缩参数
  let resolutionIndex = 0;
  let currentResolution = RESOLUTION_LEVELS[resolutionIndex];
  let currentQuality = estimateInitialQuality(file.size);
  let bestResult: Blob | null = null;
  let attempt = 0;

  try {
    // 步骤 3: 迭代压缩直到满足大小要求或达到最大尝试次数
    while (attempt < MAX_COMPRESSION_ATTEMPTS) {
      attempt++;

      // 始终从原始文件压缩
      const compressed = await performCompression(
        file,
        currentQuality,
        currentResolution
      );

      console.log(
        `第 ${attempt} 次压缩: ${formatSizeMB(
          compressed.size
        )}MB (分辨率=${currentResolution}px, 质量=${currentQuality.toFixed(2)})`
      );

      bestResult = compressed;

      // 检查是否满足大小要求
      if (compressed.size <= targetSizeBytes) {
        console.log(`✓ 达到目标大小`);
        break;
      }

      // 决定下一步策略
      if (currentQuality > MIN_QUALITY) {
        // 策略1: 降低质量
        currentQuality = Math.max(currentQuality - QUALITY_STEP, MIN_QUALITY);
        console.log(`降低质量至 ${currentQuality.toFixed(2)}`);
      } else if (resolutionIndex < RESOLUTION_LEVELS.length - 1) {
        // 策略2: 质量已达最低，降低分辨率并重置质量
        resolutionIndex++;
        currentResolution = RESOLUTION_LEVELS[resolutionIndex];
        currentQuality = 0.7; // 重置为中等质量
        console.log(
          `降低分辨率至 ${currentResolution}px，重置质量为 ${currentQuality.toFixed(
            2
          )}`
        );
      } else {
        // 策略3: 分辨率和质量都已达最低
        console.warn(
          `⚠ 已达到最低分辨率 (${currentResolution}px) 和质量 (${MIN_QUALITY})，但文件仍为 ${formatSizeMB(
            compressed.size
          )}MB`
        );
        break;
      }
    }

    if (
      attempt >= MAX_COMPRESSION_ATTEMPTS &&
      bestResult!.size > targetSizeBytes
    ) {
      console.warn(
        `⚠ 已达到最大尝试次数 (${MAX_COMPRESSION_ATTEMPTS})，最终大小: ${formatSizeMB(
          bestResult!.size
        )}MB`
      );
    }
  } catch (error) {
    // 步骤 4: 压缩失败时的降级策略
    console.error("压缩失败，尝试使用保守配置:", error);

    // 使用最保守的配置
    bestResult = await imageCompression(file, {
      maxWidthOrHeight: 640,
      fileType: "image/webp",
      initialQuality: 0.5,
      useWebWorker: false,
    });
  }

  // 步骤 5: 创建最终文件
  const originalFileName = file.name.split(".")[0];
  const compressedFile = new File([bestResult!], `${originalFileName}.webp`, {
    type: "image/webp",
  });

  console.log(
    `✓ 压缩完成: ${formatSizeMB(file.size)}MB → ${formatSizeMB(
      compressedFile.size
    )}MB`
  );

  return compressedFile;
}
