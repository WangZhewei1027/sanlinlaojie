/**
 * Cesium Viewer 管理模块
 */

import {
  VIEWER_CONFIG,
  CAMERA_CONFIG,
  IS_MOBILE,
  TIANDITU_KEY,
} from "../utils/config.js";
import { getOriginCoordinates } from "../utils/coordinateUtils.js";
import { preferWebgl1 } from "./recoveryManager.js";

let viewer = null;

/**
 * 天地图 WMTS 图层（球面墨卡托 "w" 瓦片集，EPSG:3857）
 * @param {"img" | "cia"} layer - img 影像；cia 影像注记
 */
function tiandituLayer(layer) {
  return Cesium.ImageryLayer.fromProviderAsync(
    Promise.resolve(
      new Cesium.WebMapTileServiceImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?tk=${TIANDITU_KEY}`,
        layer,
        style: "default",
        format: "tiles",
        tileMatrixSetID: "w",
        subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
        maximumLevel: 18,
        credit: "天地图",
      }),
    ),
  );
}

/** 基础 Viewer 选项：配置了天地图 key 时用天地图影像做底图 */
function baseConfig() {
  return TIANDITU_KEY
    ? { ...VIEWER_CONFIG, baseLayer: tiandituLayer("img") }
    : VIEWER_CONFIG;
}

/** 在基础选项上追加 WebGL1 降级选项 */
function webgl1Config() {
  const base = baseConfig();
  return {
    ...base,
    contextOptions: { ...base.contextOptions, requestWebgl1: true },
  };
}

/**
 * 初始化 Cesium Viewer
 * @param {string} containerId - 容器元素ID
 * @returns {Cesium.Viewer} - Cesium Viewer实例
 */
export function initViewer(containerId = "cesiumContainer") {
  // 该设备多次崩溃或曾靠 WebGL1 恢复过 → 直接用 WebGL1 初始化
  const useWebgl1 = preferWebgl1();
  if (useWebgl1) {
    console.log("使用 WebGL1 模式初始化");
  }

  try {
    viewer = new Cesium.Viewer(
      containerId,
      useWebgl1 ? webgl1Config() : baseConfig(),
    );
  } catch (error) {
    // iOS Safari 偶发返回残缺的 WebGL2 上下文，回退到 WebGL1 重试
    console.warn("WebGL2 初始化失败，回退到 WebGL1 重试:", error);
    document.getElementById(containerId).innerHTML = "";
    viewer = new Cesium.Viewer(containerId, webgl1Config());
  }

  if (TIANDITU_KEY) {
    // 影像之上叠加地名注记
    viewer.imageryLayers.add(tiandituLayer("cia"));
  }

  if (IS_MOBILE) {
    // 缩小底图影像瓦片缓存（默认 100），降低移动端显存占用
    viewer.scene.globe.tileCacheSize = 30;
  }

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

  // 打开时初始视角定位到默认 origin（organization map_center 到达后会再飞行覆盖）
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      origin.longitude,
      origin.latitude,
      origin.altitude + CAMERA_CONFIG.focusHeight,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(CAMERA_CONFIG.defaultHeading),
      pitch: Cesium.Math.toRadians(CAMERA_CONFIG.defaultPitch),
      roll: 0,
    },
  });

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
