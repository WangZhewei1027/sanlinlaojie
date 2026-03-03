/**
 * Cesium Viewer 管理模块
 */

import { VIEWER_CONFIG, CAMERA_CONFIG } from "../utils/config.js";
import { getOriginCoordinates } from "../utils/coordinateUtils.js";

let viewer = null;

/**
 * 初始化 Cesium Viewer
 * @param {string} containerId - 容器元素ID
 * @returns {Cesium.Viewer} - Cesium Viewer实例
 */
export function initViewer(containerId = "cesiumContainer") {
  viewer = new Cesium.Viewer(containerId, VIEWER_CONFIG);

  // 确保场景显示正确
  viewer.scene.globe.show = true;
  viewer.scene.globe.depthTestAgainstTerrain = false;

  // 计算并显示原点坐标
  const origin = getOriginCoordinates();
  console.log(
    `原点坐标: ${origin.longitude.toFixed(6)}°E, ${origin.latitude.toFixed(
      6,
    )}°N`,
  );

  return viewer;
}

/**
 * 获取 Viewer 实例
 * @returns {Cesium.Viewer}
 */
export function getViewer() {
  return viewer;
}

/**
 * 重置相机到默认位置
 * @param {Cesium.Cesium3DTileset} tileset - 3D Tileset对象
 */
export function resetCamera(tileset) {
  if (!viewer || !tileset) {
    console.warn("Viewer or tileset not initialized");
    return;
  }

  viewer.zoomTo(
    tileset,
    new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(CAMERA_CONFIG.defaultPitch),
      tileset.boundingSphere.radius * 2,
    ),
  );
}

/**
 * 平滑飞行到指定位置
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 * @param {Object} options - 可选配置
 */
export function flyTo(longitude, latitude, height = 0, options = {}) {
  if (!viewer) {
    console.warn("Viewer not initialized");
    return;
  }

  const {
    offset = CAMERA_CONFIG.focusHeight,
    duration = CAMERA_CONFIG.flyDuration,
    pitch = -90,
    heading = 0,
  } = options;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height + offset,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(heading),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0.0,
    },
    duration,
    complete: () => {
      console.log("飞行完成");
    },
  });
}

/**
 * 缩放到指定的tileset
 * @param {Cesium.Cesium3DTileset} tileset - 3D Tileset对象
 */
export function zoomToTileset(tileset) {
  if (!viewer || !tileset) {
    console.warn("Viewer or tileset not initialized");
    return;
  }

  viewer.zoomTo(
    tileset,
    new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(CAMERA_CONFIG.defaultPitch),
      tileset.boundingSphere.radius * 2,
    ),
  );
}

/**
 * 飞行到 origin 坐标（organization map_center 更新时调用）
 */
export function flyToOrigin() {
  if (!viewer) {
    console.warn("Viewer not initialized");
    return;
  }

  const origin = getOriginCoordinates();
  console.log(
    `飞行到 origin: ${origin.longitude.toFixed(6)}°E, ${origin.latitude.toFixed(6)}°N`,
  );

  flyTo(origin.longitude, origin.latitude, origin.altitude, {
    pitch: CAMERA_CONFIG.defaultPitch,
    duration: CAMERA_CONFIG.flyDuration,
  });
}
