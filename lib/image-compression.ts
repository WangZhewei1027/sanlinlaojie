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

// ==================== 配置常量 ====================

/** 输出格式：优先 webp，若不支持则回退为 jpeg */
const OUTPUT_TYPES = ["image/webp", "image/jpeg"] as const;

/** 最小压缩质量（对极小目标尺寸放宽） */
const MIN_QUALITY = 0.2;

/** 质量降低步长 */
const QUALITY_STEP = 0.15;

/** iOS Safari 质量降低步长（质量参数在 WebP 上几乎无效，走更小步长并更快转向降分辨率） */
const IOS_QUALITY_STEP = 0.1;

/** iOS Safari 最低质量（避免过度糊化，更多依赖降分辨率） */
const IOS_MIN_QUALITY = 0.5;

/** 判断质量调整是否无效的尺寸波动阈值 */
const QUALITY_INEFFECTIVE_DELTA = 0.03; // 3%

/** 可用的分辨率档位（从高到低） */
const RESOLUTION_LEVELS = [1920, 1280, 960];

/** 最大压缩尝试次数 */
const MAX_COMPRESSION_ATTEMPTS = 16;

/** 是否为 iOS Safari（在部分版本上禁用 Web Worker 更稳定） */
function _isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)
  );
}

/** 是否为 iOS 平台（包括 Safari 和 Chrome） */
function isIOSPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua);
}

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

/** 获取按平台排序的输出类型列表 */
function getOutputTypes(isIOS: boolean): string[] {
  // iOS 平台（包括 Safari 和 Chrome）上 WebP 压缩存在问题，优先使用 JPEG
  return isIOS ? ["image/jpeg"] : [...OUTPUT_TYPES];
}

/** 将 canvas 转为 Blob（支持类型回退，带输出类型日志） */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  preferJpeg: boolean
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const tryTypes = getOutputTypes(preferJpeg);

    const tryNext = () => {
      if (tryTypes.length === 0) {
        reject(new Error("canvas.toBlob failed for all mime types"));
        return;
      }
      const type = tryTypes.shift()!;
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(
              `[canvasToBlob] 使用输出类型: ${type}, 质量=${quality.toFixed(
                2
              )}, 尺寸=${canvas.width}x${canvas.height}`
            );
            resolve(blob);
          } else {
            tryNext();
          }
        },
        type,
        quality
      );
    };

    tryNext();
  });
}

/** 加载图片为 HTMLImageElement */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 计算目标尺寸，保持纵横比并限制最长边 */
function computeTargetSize(
  img: HTMLImageElement,
  maxSide: number
): { width: number; height: number } {
  const { naturalWidth, naturalHeight } = img;
  const longestSide = Math.max(naturalWidth, naturalHeight);
  if (longestSide <= maxSide)
    return { width: naturalWidth, height: naturalHeight };
  const scale = maxSide / longestSide;
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}

/** 从原始图片按指定质量+分辨率生成 Blob */
async function compressOnce(
  img: HTMLImageElement,
  quality: number,
  maxSide: number,
  preferJpeg: boolean
): Promise<Blob> {
  const { width, height } = computeTargetSize(img, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return await canvasToBlob(canvas, quality, preferJpeg);
}

/**
 * 执行图片压缩
 */
async function performCompression(
  img: HTMLImageElement,
  quality: number,
  maxWidthOrHeight: number,
  preferJpeg: boolean
): Promise<Blob> {
  return await compressOnce(img, quality, maxWidthOrHeight, preferJpeg);
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
  maxSizeMB: number
): Promise<File> {
  const targetSizeBytes = maxSizeMB * 1024 * 1024;
  const isIOS = isIOSPlatform(); // 检测整个 iOS 平台，不仅是 Safari
  const minQuality = isIOS ? IOS_MIN_QUALITY : MIN_QUALITY;
  const qualityStep = isIOS ? IOS_QUALITY_STEP : QUALITY_STEP;
  const preferJpeg = isIOS;

  // 步骤 1: 检查是否需要压缩
  if (file.size <= targetSizeBytes) {
    console.log(
      `文件已小于 ${maxSizeMB}MB (${formatSizeKB(file.size)}KB)，跳过压缩`
    );
    return file;
  }

  console.log(`开始压缩: ${formatSizeMB(file.size)}MB，目标: ${maxSizeMB}MB`);

  // 步骤 2: 初始化压缩参数
  const img = await loadImage(file);
  let resolutionIndex = 0;
  let currentResolution = RESOLUTION_LEVELS[resolutionIndex];
  let currentQuality = estimateInitialQuality(file.size);
  let bestResult: Blob | null = null;
  let attempt = 0;
  let lastCompressedSize = file.size;

  try {
    // 步骤 3: 迭代压缩直到满足大小要求或达到最大尝试次数
    while (attempt < MAX_COMPRESSION_ATTEMPTS) {
      attempt++;

      // 始终从原始文件压缩
      const compressed = await performCompression(
        img,
        currentQuality,
        currentResolution,
        preferJpeg
      );

      console.log(
        `第 ${attempt} 次压缩: ${formatSizeMB(
          compressed.size
        )}MB (分辨率=${currentResolution}px, 质量=${currentQuality.toFixed(2)})`
      );

      bestResult = compressed;
      const sizeChangeRatio =
        Math.abs(compressed.size - lastCompressedSize) / lastCompressedSize;
      lastCompressedSize = compressed.size;

      // 检查是否满足大小要求
      if (compressed.size <= targetSizeBytes) {
        console.log(`✓ 达到目标大小`);
        break;
      }

      // 决定下一步策略
      if (currentQuality > minQuality) {
        // 策略1: 优先降质量；若质量参数几乎不生效（iOS Safari 常见），直接降分辨率
        const qualitySeemsIneffective =
          isIOS && sizeChangeRatio < QUALITY_INEFFECTIVE_DELTA;

        if (
          qualitySeemsIneffective &&
          resolutionIndex < RESOLUTION_LEVELS.length - 1
        ) {
          resolutionIndex++;
          currentResolution = RESOLUTION_LEVELS[resolutionIndex];
          currentQuality = Math.max(currentQuality, 0.7);
          console.log(
            `质量调整无明显效果，降分辨率至 ${currentResolution}px，保持质量 ${currentQuality.toFixed(
              2
            )}`
          );
        } else {
          currentQuality = Math.max(currentQuality - qualityStep, minQuality);
          console.log(`降低质量至 ${currentQuality.toFixed(2)}`);
        }
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
          `⚠ 已达到最低分辨率 (${currentResolution}px) 和质量 (${minQuality})，但文件仍为 ${formatSizeMB(
            compressed.size
          )}MB`
        );
        break;
      }
    }

    // 额外兜底：迭代结束仍未达标时，用最小分辨率和质量再尝试一次
    if (bestResult && bestResult.size > targetSizeBytes) {
      bestResult = await compressOnce(
        img,
        minQuality,
        RESOLUTION_LEVELS[RESOLUTION_LEVELS.length - 1],
        preferJpeg
      );
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
    bestResult = await compressOnce(img, 0.5, 640, preferJpeg);
  }

  // 步骤 5: 创建最终文件
  const originalFileName = file.name.split(".")[0];
  // 根据实际输出格式确定文件扩展名和 MIME 类型
  const outputType = isIOS ? "image/jpeg" : "image/webp";
  const extension = isIOS ? "jpg" : "webp";
  const compressedFile = new File(
    [bestResult!],
    `${originalFileName}.${extension}`,
    {
      type: outputType,
    }
  );

  console.log(
    `✓ 压缩完成: ${formatSizeMB(file.size)}MB → ${formatSizeMB(
      compressedFile.size
    )}MB (格式: ${extension})`
  );

  return compressedFile;
}
