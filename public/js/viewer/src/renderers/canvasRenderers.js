/**
 * Canvas渲染模块 - 处理各种类型资产的canvas绘制
 */

import {
  BILLBOARD_CONFIG,
  IMAGE_CONFIG,
  TEXT_CONFIG,
} from "../utils/config.js";

// 图片缓存
const imageCache = new Map();

/**
 * 创建文本canvas
 * @param {string} text - 文本内容
 * @returns {HTMLCanvasElement} - Canvas元素
 */
export function createTextCanvas(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // 设置字体
  const fontSize = TEXT_CONFIG.fontSize;
  const lineHeight = fontSize * TEXT_CONFIG.lineHeight;
  ctx.font = `${fontSize}px Arial`;

  // 文本换行处理
  const maxWidth = TEXT_CONFIG.maxWidth;
  const padding = TEXT_CONFIG.padding;
  const lines = wrapText(ctx, text, maxWidth - padding * 2);

  // 计算canvas尺寸
  const canvasWidth = maxWidth;
  const canvasHeight = lines.length * lineHeight + padding * 2;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 绘制背景（带圆角）
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  roundRect(ctx, 0, 0, canvasWidth, canvasHeight, TEXT_CONFIG.borderRadius);
  ctx.fill();

  // 绘制文本（需要重新设置字体，因为canvas尺寸改变会重置样式）
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = "#d1d5db";
  ctx.textBaseline = "top";

  // 逐行绘制文本
  lines.forEach((line, index) => {
    ctx.fillText(line, padding, padding + index * lineHeight);
  });

  console.log(
    `创建文本canvas: "${text}", 行数: ${lines.length}, 尺寸: ${canvas.width}x${canvas.height}`
  );

  return canvas;
}

/**
 * 创建图片canvas (异步加载)
 * @param {string} fileUrl - 图片URL
 * @returns {Promise<HTMLCanvasElement>} - Canvas元素Promise
 */
export function createImageCanvas(fileUrl) {
  console.log(`准备加载图片: ${fileUrl}`);

  // 检查缓存
  if (imageCache.has(fileUrl)) {
    console.log(`使用缓存的图片: ${fileUrl}`);
    const cachedCanvas = imageCache.get(fileUrl);

    // 验证缓存的 canvas 尺寸
    if (!cachedCanvas.width || !cachedCanvas.height) {
      console.warn(`缓存的 canvas 尺寸无效: ${fileUrl}`);
      imageCache.delete(fileUrl);
      // 继续执行加载逻辑
    } else {
      // 创建新的canvas并复制内容
      const canvas = document.createElement("canvas");
      canvas.width = cachedCanvas.width;
      canvas.height = cachedCanvas.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(cachedCanvas, 0, 0);
      return Promise.resolve(canvas);
    }
  }

  // 创建Image对象加载图片
  const img = new Image();
  img.crossOrigin = "anonymous";

  // 返回一个Promise，在图片加载完成后resolve
  return new Promise((resolve, reject) => {
    img.onload = function () {
      // 验证图片尺寸
      if (!img.width || !img.height) {
        console.error(`图片尺寸无效: ${fileUrl}`);
        reject(new Error("Invalid image dimensions"));
        return;
      }

      // 创建canvas来绘制图片
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // 计算缩放后的尺寸，限制最大尺寸
      let width = img.width;
      let height = img.height;

      console.log(`原始图片尺寸: ${width}x${height}`);

      // 如果图片超过最大尺寸，按比例缩放
      if (width > IMAGE_CONFIG.maxWidth || height > IMAGE_CONFIG.maxHeight) {
        const ratio = Math.min(
          IMAGE_CONFIG.maxWidth / width,
          IMAGE_CONFIG.maxHeight / height
        );
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
        console.log(
          `图片缩放: ${img.width}x${
            img.height
          } -> ${width}x${height}, 比例: ${ratio.toFixed(3)}`
        );
      } else {
        console.log(`图片无需缩放: ${width}x${height}`);
      }

      // 设置canvas大小
      canvas.width = width;
      canvas.height = height;

      // 绘制图片到canvas
      ctx.drawImage(img, 0, 0, width, height);

      console.log(
        `图片加载成功: ${fileUrl}, 原始: ${img.width}x${img.height}, 使用: ${width}x${height}`
      );

      // 缓存canvas
      imageCache.set(fileUrl, canvas);

      resolve(canvas);
    };

    img.onerror = function (error) {
      console.error(`图片加载失败: ${fileUrl}`, error);

      // 加载失败时返回一个带错误标记的canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = BILLBOARD_CONFIG.iconSize;
      canvas.height = BILLBOARD_CONFIG.iconSize;
      ctx.fillStyle = "#ef4444"; // 红色表示错误
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.fill();

      // 画一个X
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(24, 24);
      ctx.moveTo(24, 8);
      ctx.lineTo(8, 24);
      ctx.stroke();

      resolve(canvas);
    };

    img.src = fileUrl;
  });
}

/**
 * 创建图标canvas
 * @param {string} fileType - 文件类型
 * @returns {HTMLCanvasElement} - Canvas元素
 */
export function createIconCanvas(fileType) {
  const canvas = document.createElement("canvas");
  canvas.width = BILLBOARD_CONFIG.iconSize;
  canvas.height = BILLBOARD_CONFIG.iconSize;
  const ctx = canvas.getContext("2d");

  // 背景圆
  ctx.fillStyle = fileType === "image" ? "#3b82f6" : "#10b981";
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();

  // 白色边框
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

/**
 * 文本换行处理
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {string} text - 文本内容
 * @param {number} maxWidth - 最大宽度
 * @returns {Array<string>} - 换行后的文本数组
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split("");
  const lines = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

/**
 * 绘制圆角矩形
 * @param {CanvasRenderingContext2D} ctx - Canvas上下文
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} radius - 圆角半径
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 获取图片缓存大小
 * @returns {number} - 缓存中的图片数量
 */
export function getImageCacheSize() {
  return imageCache.size;
}

/**
 * 清除图片缓存
 */
export function clearImageCache() {
  imageCache.clear();
}
