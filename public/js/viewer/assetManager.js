/**
 * 资产管理模块
 */

import {
  BILLBOARD_CONFIG,
  FOCUS_MARKER_CONFIG,
  IMAGE_CONFIG,
  TEXT_CONFIG,
} from "./config.js";
import { getViewer, flyTo } from "./viewerManager.js";

let assetBillboards = []; // 存储 asset 标记
let focusMarkerEntity = null; // 存储聚焦标记
let imageCache = new Map(); // 缓存加载的图片

/**
 * 在地图上显示 assets
 * @param {Array} assets - 资产数组
 */
export function displayAssets(assets) {
  const viewer = getViewer();
  if (!viewer) {
    console.warn("Viewer not initialized");
    return;
  }

  // 清除之前的 billboards
  clearAssetBillboards();

  console.log(`显示 ${assets.length} 个 assets`);

  // 为每个有坐标的 asset 添加 billboard
  assets.forEach((asset) => {
    const { longitude, latitude, height } = asset.metadata;

    if (longitude !== undefined && latitude !== undefined) {
      console.log(
        `处理资产: ${asset.id}, 类型: ${asset.file_type}, 文本: ${asset.text_content}, URL: ${asset.file_url}`
      );

      createBillboard(asset, longitude, latitude, height);
    }
  });
}

/**
 * 创建Billboard
 * @param {Object} asset - 资产对象
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 */
function createBillboard(asset, longitude, latitude, height) {
  const viewer = getViewer();
  if (!viewer) return;

  const billboardImage = getBillboardImage(
    asset.file_type,
    asset.file_url,
    asset.text_content
  );

  // 根据文件类型选择合适的scale
  let scale = BILLBOARD_CONFIG.scale;
  if (asset.file_type === "image" && asset.file_url) {
    scale = BILLBOARD_CONFIG.imageScale;
  } else if (asset.file_type === "text") {
    scale = BILLBOARD_CONFIG.textScale;
  }

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 0),
    billboard: {
      image: billboardImage,
      scale: scale,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(
        BILLBOARD_CONFIG.scaleByDistanceNear,
        BILLBOARD_CONFIG.scaleByDistanceNearValue,
        BILLBOARD_CONFIG.scaleByDistanceFar,
        BILLBOARD_CONFIG.scaleByDistanceFarValue
      ),
      sizeInMeters: false,
      pixelOffsetScaleByDistance: undefined,
      imageSubRegion: undefined,
    },
    properties: {
      assetId: asset.id,
      fileType: asset.file_type,
      fileUrl: asset.file_url,
    },
  });

  assetBillboards.push(entity);

  console.log(`创建billboard: ${asset.id}, 类型: ${asset.file_type}`);
}

/**
 * 清除所有资产标记
 */
export function clearAssetBillboards() {
  const viewer = getViewer();
  if (!viewer) return;

  assetBillboards.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  assetBillboards = [];

  console.log(`已清除billboards，图片缓存保留: ${imageCache.size} 个`);
}

/**
 * 根据文件类型返回对应的 billboard 图标
 * @param {string} fileType - 文件类型
 * @param {string} fileUrl - 文件URL
 * @param {string} textContent - 文本内容（当fileType为text时）
 * @returns {HTMLCanvasElement|Promise<HTMLCanvasElement>} - Canvas元素或Promise
 */
function getBillboardImage(fileType, fileUrl, textContent) {
  // 处理文本类型
  if (fileType === "text" && textContent) {
    return createTextCanvas(textContent);
  }

  // 如果是图片类型且有 URL，预加载图片并绘制到canvas
  if (fileType === "image" && fileUrl) {
    console.log(`准备加载图片: ${fileUrl}`);

    // 检查缓存 - 返回克隆的canvas而不是原始引用
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
        return canvas;
      }
    }

    // 创建Image对象加载图片
    const img = new Image();
    img.crossOrigin = "anonymous";

    // 返回一个Promise，在图片加载完成后resolve
    const promise = new Promise((resolve, reject) => {
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

        // 绘制图片到canvas（如果需要缩放）
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

    // 直接返回promise，让Cesium处理加载状态
    return promise;
  }

  // 其他类型使用简单图标
  return createIconCanvas(fileType);
}

/**
 * 创建文本canvas
 * @param {string} text - 文本内容
 * @returns {HTMLCanvasElement} - Canvas元素
 */
function createTextCanvas(text) {
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
 * 创建图标canvas
 * @param {string} fileType - 文件类型
 * @returns {HTMLCanvasElement} - Canvas元素
 */
function createIconCanvas(fileType) {
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
 * 聚焦到指定资产
 * @param {Object} assetData - 资产数据
 */
export function focusOnAsset(assetData) {
  const viewer = getViewer();
  if (!viewer) {
    console.warn("Viewer not initialized");
    return;
  }

  const { id, longitude, latitude, height } = assetData;

  if (longitude === undefined || latitude === undefined) {
    console.warn("资产位置信息不完整:", assetData);
    return;
  }

  console.log(
    `聚焦到资产: ${id} (${longitude.toFixed(6)}°, ${latitude.toFixed(6)}°)`
  );

  // 创建目标位置
  const position = Cesium.Cartesian3.fromDegrees(
    longitude,
    latitude,
    height || 0
  );

  // 移除之前的聚焦标记
  clearFocusMarker();

  // 在目标位置添加高亮标记
  focusMarkerEntity = viewer.entities.add({
    position: position,
    point: {
      pixelSize: FOCUS_MARKER_CONFIG.pointSize,
      color: FOCUS_MARKER_CONFIG.pointColor,
      outlineColor: FOCUS_MARKER_CONFIG.outlineColor,
      outlineWidth: FOCUS_MARKER_CONFIG.outlineWidth,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    ellipse: {
      semiMinorAxis: FOCUS_MARKER_CONFIG.ellipseSemiAxis,
      semiMajorAxis: FOCUS_MARKER_CONFIG.ellipseSemiAxis,
      height: height || 0,
      material: new Cesium.ColorMaterialProperty(
        FOCUS_MARKER_CONFIG.pointColor.withAlpha(
          FOCUS_MARKER_CONFIG.ellipseAlpha
        )
      ),
      outline: true,
      outlineColor: FOCUS_MARKER_CONFIG.pointColor,
      outlineWidth: 2,
    },
  });

  // 平滑飞行到目标位置
  flyTo(longitude, latitude, height || 0);
}

/**
 * 清除聚焦标记
 */
export function clearFocusMarker() {
  const viewer = getViewer();
  if (!viewer) return;

  if (focusMarkerEntity) {
    viewer.entities.remove(focusMarkerEntity);
    focusMarkerEntity = null;
  }
}

/**
 * 获取所有资产标记
 * @returns {Array} - 资产标记数组
 */
export function getAssetBillboards() {
  return assetBillboards;
}
