/**
 * 资产管理模块
 */

import { BILLBOARD_CONFIG, FOCUS_MARKER_CONFIG } from "../utils/config.js";
import { getViewer, flyTo } from "./viewerManager.js";
import {
  createTextCanvas,
  createImageCanvas,
  createIconCanvas,
  getImageCacheSize,
} from "../renderers/canvasRenderers.js";
import { createAnchorCanvas } from "../renderers/anchorRenderer.js";
import { createAudioCanvas } from "../renderers/audioRenderer.js";
import { createLinkCanvas } from "../renderers/linkRenderer.js";
import {
  createAnchorConnectionLines,
  clearAnchorConnectionLines,
} from "./anchorConnectionManager.js";
import {
  createDotCanvas,
  createDetailCanvas,
  updateAllLODs,
} from "../utils/lodManager.js";

let assetBillboards = []; // 存储 asset 标记
let focusMarkerEntity = null; // 存储聚焦标记
let currentAssets = []; // 存储当前显示的assets数据（用于LOD）
let lodUpdateInterval = null; // LOD更新定时器

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

  // 保存assets数据
  currentAssets = assets;

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

  // 创建锚点关联线
  createAnchorConnectionLines(assets);

  // 启动LOD更新
  startLODUpdate();
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

  // 初始使用点显示（LOD会根据距离自动切换）
  const billboardImage = createDotCanvas(asset.file_type);

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 0),
    billboard: {
      image: billboardImage,
      scale: 1.0,
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
      lodLevel: "dot", // 初始LOD级别
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
  currentAssets = [];

  // 清除锚点关联线
  clearAnchorConnectionLines();

  // 停止LOD更新
  stopLODUpdate();

  console.log(`已清除billboards，图片缓存保留: ${getImageCacheSize()} 个`);
}

/**
 * 根据文件类型返回对应的 billboard 图标
 * @param {Object} asset - 资产对象
 * @returns {HTMLCanvasElement|Promise<HTMLCanvasElement>} - Canvas元素或Promise
 */
function getBillboardImage(asset) {
  const { file_type, file_url, text_content, name, metadata } = asset;

  // 处理锚点类型
  if (file_type === "anchor") {
    return createAnchorCanvas(name, text_content);
  }

  // 处理音频类型
  if (file_type === "audio") {
    return createAudioCanvas(name || file_url?.split("/").pop(), metadata);
  }

  // 处理链接类型
  if (file_type === "link") {
    return createLinkCanvas(name, metadata);
  }

  // 处理文本类型
  if (file_type === "text" && text_content) {
    return createTextCanvas(text_content);
  }

  // 如果是图片类型且有 URL，预加载图片并绘制到canvas
  if (file_type === "image" && file_url) {
    return createImageCanvas(file_url);
  }

  // 其他类型使用简单图标
  return createIconCanvas(file_type);
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

/**
 * 启动LOD更新
 */
function startLODUpdate() {
  const viewer = getViewer();
  if (!viewer) return;

  // 如果已经有定时器，先清除
  stopLODUpdate();

  // 监听相机移动事件
  viewer.camera.moveEnd.addEventListener(updateLOD);

  // 初始更新一次
  updateLOD();

  console.log("LOD更新已启动");
}

/**
 * 停止LOD更新
 */
function stopLODUpdate() {
  const viewer = getViewer();
  if (!viewer) return;

  viewer.camera.moveEnd.removeEventListener(updateLOD);

  console.log("LOD更新已停止");
}

/**
 * 更新LOD
 */
function updateLOD() {
  updateAllLODs(assetBillboards, currentAssets);
}
