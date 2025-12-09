/**
 * 资产管理模块
 */

import { BILLBOARD_CONFIG, FOCUS_MARKER_CONFIG } from "./config.js";
import { getViewer, flyTo } from "./viewerManager.js";

let assetBillboards = []; // 存储 asset 标记
let focusMarkerEntity = null; // 存储聚焦标记

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
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          height || 0
        ),
        billboard: {
          image: getBillboardImage(asset.file_type, asset.file_url),
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
        },
        properties: {
          assetId: asset.id,
          fileType: asset.file_type,
          fileUrl: asset.file_url,
        },
      });

      assetBillboards.push(entity);
    }
  });
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
}

/**
 * 根据文件类型返回对应的 billboard 图标
 * @param {string} fileType - 文件类型
 * @param {string} fileUrl - 文件URL
 * @returns {HTMLCanvasElement|string} - Canvas元素或图片URL
 */
function getBillboardImage(fileType, fileUrl) {
  // 如果是图片类型且有 URL，直接返回图片 URL
  if (fileType === "image" && fileUrl) {
    return fileUrl;
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
