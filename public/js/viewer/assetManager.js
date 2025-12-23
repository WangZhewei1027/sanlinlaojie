/**
 * 资产管理模块
 */

import {
  BILLBOARD_CONFIG,
  FOCUS_MARKER_CONFIG,
  IMAGE_CONFIG,
} from "./config.js";
import { getViewer, flyTo } from "./viewerManager.js";

let assetBillboards = []; // 存储 asset 标记
let focusMarkerEntity = null; // 存储聚焦标记
let textOverlays = []; // 存储文本HTML元素
let overlayContainer = null; // HTML容器
let preRenderListener = null; // preRender事件监听器
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

  // 创建HTML容器（如果不存在）
  if (!overlayContainer) {
    overlayContainer = document.createElement("div");
    overlayContainer.id = "cesium-text-overlay";
    overlayContainer.style.position = "absolute";
    overlayContainer.style.top = "0";
    overlayContainer.style.left = "0";
    overlayContainer.style.pointerEvents = "none";
    overlayContainer.style.zIndex = "1000";
    overlayContainer.style.width = "100%";
    overlayContainer.style.height = "100%";
    viewer.container.appendChild(overlayContainer);
  }

  console.log(`显示 ${assets.length} 个 assets`);

  // 为每个有坐标的 asset 添加 billboard 或 text overlay
  assets.forEach((asset) => {
    const { longitude, latitude, height } = asset.metadata;

    if (longitude !== undefined && latitude !== undefined) {
      console.log(
        `处理资产: ${asset.id}, 类型: ${asset.file_type}, 文本: ${asset.text_content}, URL: ${asset.file_url}`
      );

      if (asset.file_type === "text" && asset.text_content) {
        createTextOverlay(asset, longitude, latitude, height);
      } else {
        createImageBillboard(asset, longitude, latitude, height);
      }
    }
  });

  // 设置preRender监听器来更新文本位置
  if (textOverlays.length > 0 && !preRenderListener) {
    console.log(`设置preRender监听器，文本覆盖层数量: ${textOverlays.length}`);
    preRenderListener = viewer.scene.preRender.addEventListener(() => {
      updateTextOverlayPositions(viewer);
    });
  }
}

/**
 * 创建文本覆盖层
 * @param {Object} asset - 资产对象
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 */
function createTextOverlay(asset, longitude, latitude, height) {
  console.log(
    `创建文本覆盖层: "${asset.text_content}" at (${longitude}, ${latitude})`
  );

  const textDiv = document.createElement("div");
  textDiv.textContent = asset.text_content;
  textDiv.style.position = "absolute";
  textDiv.style.display = "inline-block";
  textDiv.style.maxWidth = "150px";
  textDiv.style.fontSize = "8px";
  textDiv.style.fontWeight = "400";
  textDiv.style.color = "#d1d5db";
  textDiv.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
  textDiv.style.backdropFilter = "blur(8px)";
  textDiv.style.webkitBackdropFilter = "blur(8px)";
  textDiv.style.padding = "8px 12px";
  textDiv.style.borderRadius = "6px";
  textDiv.style.textAlign = "left";
  textDiv.style.overflow = "hidden";
  textDiv.style.textOverflow = "ellipsis";
  textDiv.style.whiteSpace = "nowrap";
  textDiv.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
  textDiv.style.transform = "translate(-50%, -100%)";
  textDiv.style.marginTop = "-10px";

  overlayContainer.appendChild(textDiv);

  console.log(
    `文本div已添加到容器，容器子元素数: ${overlayContainer.children.length}`
  );

  textOverlays.push({
    div: textDiv,
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 0),
    scratch: new Cesium.Cartesian2(),
    assetId: asset.id,
  });
}

/**
 * 创建图片Billboard
 * @param {Object} asset - 资产对象
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 */
function createImageBillboard(asset, longitude, latitude, height) {
  const viewer = getViewer();
  if (!viewer) return;

  const billboardImage = getBillboardImage(asset.file_type, asset.file_url);

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 0),
    billboard: {
      image: billboardImage,
      scale: BILLBOARD_CONFIG.scale,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(
        BILLBOARD_CONFIG.scaleByDistanceNear,
        BILLBOARD_CONFIG.scaleByDistanceNearValue,
        BILLBOARD_CONFIG.scaleByDistanceFar,
        BILLBOARD_CONFIG.scaleByDistanceFarValue
      ),
      sizeInMeters: false,
      // 添加这些属性来改善图片渲染
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

  // 添加调试信息
  console.log(
    `创建billboard: ${asset.id}, 图片: ${asset.file_url ? "外部URL" : "Canvas"}`
  );
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

  // 清除文本覆盖层
  textOverlays.forEach((overlay) => {
    if (overlay.div.parentNode) {
      overlay.div.parentNode.removeChild(overlay.div);
    }
  });
  textOverlays = [];

  // 移除preRender监听器
  if (preRenderListener) {
    preRenderListener();
    preRenderListener = null;
  }

  // 注意：不清除imageCache，以便重复使用已加载的图片
  console.log(`已清除billboards，图片缓存保留: ${imageCache.size} 个`);
}

/**
 * 更新文本覆盖层的屏幕位置
 */
function updateTextOverlayPositions(viewer) {
  textOverlays.forEach((overlay, index) => {
    const canvasPosition = viewer.scene.cartesianToCanvasCoordinates(
      overlay.position,
      overlay.scratch
    );

    if (Cesium.defined(canvasPosition)) {
      overlay.div.style.left = `${canvasPosition.x}px`;
      overlay.div.style.top = `${canvasPosition.y}px`;
      overlay.div.style.display = "block";

      // 只在第一次更新时打印
      if (!overlay.positioned) {
        console.log(
          `文本 #${index} 位置更新: (${canvasPosition.x.toFixed(
            0
          )}, ${canvasPosition.y.toFixed(0)})`
        );
        overlay.positioned = true;
      }
    } else {
      // 位置不可见时隐藏
      overlay.div.style.display = "none";
    }
  });
}

/**
 * 根据文件类型返回对应的 billboard 图标
 * @param {string} fileType - 文件类型
 * @param {string} fileUrl - 文件URL
 * @returns {HTMLCanvasElement|Promise<HTMLCanvasElement>} - Canvas元素或Promise
 */
function getBillboardImage(fileType, fileUrl) {
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

        // 如果图片超过最大尺寸，按比例缩放
        if (width > IMAGE_CONFIG.maxWidth || height > IMAGE_CONFIG.maxHeight) {
          const ratio = Math.min(
            IMAGE_CONFIG.maxWidth / width,
            IMAGE_CONFIG.maxHeight / height
          );
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
          console.log(
            `图片缩放: ${img.width}x${img.height} -> ${width}x${height}`
          );
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
    // Cesium原生支持Promise<Image>或Promise<Canvas>
    return promise;
  }

  // 否则使用 Canvas 生成简单的图标
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
