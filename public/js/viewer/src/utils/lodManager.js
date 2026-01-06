/**
 * LOD (Level of Detail) 管理模块
 * 根据距离动态切换渲染内容
 */

import { getViewer } from "../managers/viewerManager.js";
import {
  createTextCanvas,
  createImageCanvas,
  createIconCanvas,
} from "../renderers/canvasRenderers.js";
import { createAnchorCanvas } from "../renderers/anchorRenderer.js";
import { createAudioCanvas } from "../renderers/audioRenderer.js";
import { createLinkCanvas } from "../renderers/linkRenderer.js";

// LOD距离配置（米）
export const LOD_CONFIG = {
  // 远距离阈值：超过此距离显示为点
  farThreshold: 21,
  // 近距离阈值：小于此距离显示详细内容
  nearThreshold: 20,
  // 点的大小配
  dotSize: 72,
  dotPadding: 2,
};

/**
 * 创建简单的点canvas（用于远距离显示）
 * @param {string} fileType - 文件类型（用于决定颜色）
 * @returns {HTMLCanvasElement}
 */
export function createDotCanvas(fileType) {
  const size = LOD_CONFIG.dotSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - LOD_CONFIG.dotPadding;

  // 根据文件类型选择颜色
  const colorMap = {
    anchor: "#FFFF1E", // 金色
    audio: "#9700FF", // 紫色
    link: "#FF45FF", // 粉色
    image: "#00FFFF", // 蓝色
    text: "#F00000", // 红色
    default: "#64748b", // 默认灰色
  };

  const color = colorMap[fileType] || colorMap.default;

  // 绘制圆点
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // 绘制白色边框
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.stroke();

  return canvas;
}

/**
 * 创建详细内容canvas
 * @param {Object} asset - 资产对象
 * @returns {HTMLCanvasElement|Promise<HTMLCanvasElement>}
 */
export function createDetailCanvas(asset) {
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

  // 如果是图片类型且有 URL
  if (file_type === "image" && file_url) {
    return createImageCanvas(file_url);
  }

  // 其他类型使用简单图标
  return createIconCanvas(file_type);
}

/**
 * 计算相机到实体的距离
 * @param {Cesium.Entity} entity - 实体对象
 * @returns {number} - 距离（米）
 */
export function getDistanceToEntity(entity) {
  const viewer = getViewer();
  if (!viewer || !entity || !entity.position) {
    return Infinity;
  }

  const cameraPosition = viewer.camera.position;
  const entityPosition = entity.position.getValue(Cesium.JulianDate.now());

  if (!entityPosition) {
    return Infinity;
  }

  return Cesium.Cartesian3.distance(cameraPosition, entityPosition);
}

/**
 * 根据距离决定LOD级别
 * @param {number} distance - 距离（米）
 * @returns {string} - LOD级别：'dot'（点）或 'detail'（详细）
 */
export function getLODLevel(distance) {
  if (distance > LOD_CONFIG.farThreshold) {
    return "dot";
  } else if (distance < LOD_CONFIG.nearThreshold) {
    return "detail";
  }

  // 在中间范围，保持当前状态（避免频繁切换）
  return "unchanged";
}

/**
 * 更新实体的LOD
 * @param {Cesium.Entity} entity - 实体对象
 * @param {Object} asset - 资产数据
 */
export function updateEntityLOD(entity, asset) {
  if (!entity || !entity.billboard) {
    return;
  }

  const distance = getDistanceToEntity(entity);
  const newLevel = getLODLevel(distance);

  // 获取当前LOD级别（存储在entity属性中）
  const currentLevel = entity.properties?.lodLevel?.getValue() || "detail";

  // 如果需要切换LOD
  if (newLevel !== "unchanged" && newLevel !== currentLevel) {
    console.log(
      `切换LOD: ${asset.id}, 距离: ${distance.toFixed(
        1
      )}m, ${currentLevel} -> ${newLevel}`
    );

    if (newLevel === "dot") {
      // 切换到点显示
      entity.billboard.image = createDotCanvas(asset.file_type);
      entity.billboard.scale = 1.0;
    } else {
      // 切换到详细显示
      const detailCanvas = createDetailCanvas(asset);
      entity.billboard.image = detailCanvas;

      // 根据类型设置适当的scale
      const scaleMap = {
        anchor: 6.0,
        audio: 6.0,
        link: 6.0,
        image: 2.0,
        text: 5.0,
        default: 0.5,
      };
      entity.billboard.scale = scaleMap[asset.file_type] || scaleMap.default;
    }

    // 更新LOD级别标记
    entity.properties.lodLevel = newLevel;
  }
}

/**
 * 批量更新所有实体的LOD
 * @param {Array} billboards - billboard实体数组
 * @param {Array} assets - 资产数据数组
 */
export function updateAllLODs(billboards, assets) {
  if (!billboards || billboards.length === 0) {
    return;
  }

  // 创建asset id到asset的映射
  const assetMap = new Map();
  assets.forEach((asset) => {
    assetMap.set(asset.id, asset);
  });

  // 更新每个billboard的LOD
  billboards.forEach((entity) => {
    const assetId = entity.properties?.assetId?.getValue();
    const asset = assetMap.get(assetId);

    if (asset) {
      updateEntityLOD(entity, asset);
    }
  });
}
