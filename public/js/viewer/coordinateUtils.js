/**
 * 坐标转换工具模块
 */

import { METADATA } from "./config.js";

/**
 * UTM Zone 51N 转换为经纬度
 * @param {number} easting - UTM东向坐标
 * @param {number} northing - UTM北向坐标
 * @returns {Cesium.Cartesian3} - Cesium 笛卡尔坐标
 */
export function utm51NToWGS84(easting, northing) {
  const zone = 51;
  const centerLon = (zone - 1) * 6 - 180 + 3; // 123°E

  // 简化转换（实际应使用 proj4.js）
  const lat = northing / 110540; // 近似纬度
  const lon = centerLon + easting / (111320 * Math.cos((lat * Math.PI) / 180));

  return Cesium.Cartesian3.fromDegrees(lon, lat, 0);
}

/**
 * 计算并返回原点的经纬度坐标
 * @returns {Object} 包含经度、纬度和高度的对象
 */
export function getOriginCoordinates() {
  const originCartesian = utm51NToWGS84(
    METADATA.origin.easting,
    METADATA.origin.northing
  );
  const originCartographic = Cesium.Cartographic.fromCartesian(originCartesian);

  return {
    longitude: Cesium.Math.toDegrees(originCartographic.longitude),
    latitude: Cesium.Math.toDegrees(originCartographic.latitude),
    altitude: METADATA.origin.altitude,
  };
}

/**
 * 将经纬度转换为 Cartesian3
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度（可选，默认0）
 * @returns {Cesium.Cartesian3}
 */
export function lonLatToCartesian(longitude, latitude, height = 0) {
  return Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
}

/**
 * 将 Cartesian3 转换为经纬度
 * @param {Cesium.Cartesian3} cartesian - Cesium笛卡尔坐标
 * @returns {Object} 包含经度、纬度和高度的对象
 */
export function cartesianToLonLat(cartesian) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height,
  };
}
