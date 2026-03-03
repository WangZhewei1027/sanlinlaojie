/**
 * Cesium Viewer 配置模块
 */

// Cesium Ion token (使用默认 token，生产环境需要自己的 token)
export const CESIUM_ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhOGY2YWFlOC01YWRlLTRlMTAtYmEwZC1hY2YyYTc3YTZmYmMiLCJpZCI6MzY3ODkyLCJpYXQiOjE3NjUyNTg2OTJ9.QOxskQVs1h4gUDRB7c_VvaBniXIgwuronD6__ZiPY_U";

// 元数据配置（origin 可由外部动态更新）
export const METADATA = {
  srs: "EPSG:32651", // WGS 84 / UTM zone 51N
  origin: {
    // GPS 坐标（经纬度），由外部 organization 配置传入
    lat: null,
    lng: null,
    // UTM 坐标（向后兼容）
    easting: 356865.71708580491,
    northing: 3446141.014862847,
    altitude: 75.355000000997293,
  },
};

/**
 * 更新 origin 坐标（从 organization.map_center 获取）
 * @param {{ lat: number, lng: number }} center - GPS 中心点
 */
export function setOrigin(center) {
  if (
    center &&
    typeof center.lat === "number" &&
    typeof center.lng === "number"
  ) {
    METADATA.origin.lat = center.lat;
    METADATA.origin.lng = center.lng;
    console.log(`Origin 已更新: ${center.lat}, ${center.lng}`);
  }
}

// 3D Tiles 配置
export const TILESET_CONFIG = {
  url: "./terra_b3dms/tileset.json",
  options: {
    maximumScreenSpaceError: 2,
    skipLevelOfDetail: true,
    immediatelyLoadDesiredLevelOfDetail: true,
    loadSiblings: true,
    cullWithChildrenBounds: false,
  },
  totalTiles: 8,
};

// Viewer 配置
export const VIEWER_CONFIG = {
  timeline: false,
  animation: false,
  baseLayerPicker: true,
  geocoder: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  infoBox: false,
};

// Billboard 图片配置
export const IMAGE_CONFIG = {
  maxWidth: 512, // 最大宽度（像素）- billboard 优化尺寸
  maxHeight: 512, // 最大高度（像素）- billboard 优化尺寸
};

// 文本配置
export const TEXT_CONFIG = {
  maxWidth: 300, // 文本最大宽度（像素）
  fontSize: 14, // 字体大小
  lineHeight: 1.4, // 行高倍数
  padding: 16, // 内边距
  borderRadius: 6, // 圆角半径
};

// 相机配置
export const CAMERA_CONFIG = {
  defaultPitch: -45, // 度
  defaultHeading: 0,
  focusHeight: 30, // 聚焦时相机高度偏移（米）
  flyDuration: 2.0, // 飞行动画时长（秒）
};

// Billboard 配置
export const BILLBOARD_CONFIG = {
  scale: 0.5, // 图标默认缩放
  imageScale: 2, // 图片类型billboard的缩放（更大以便看清）
  textScale: 5, // 文本类型billboard的缩放
  anchorScale: 6.0, // 锚点类型billboard的缩放
  audioScale: 6.0, // 音频类型billboard的缩放
  scaleByDistanceNear: 100,
  scaleByDistanceNearValue: 0.3,
  scaleByDistanceFar: 1000,
  scaleByDistanceFarValue: 0.05,
  iconSize: 32,
};

// 点击标记配置
export const CLICK_MARKER_CONFIG = {
  pointSize: 15,
  pointColor: Cesium.Color.CYAN,
  outlineWidth: 2,
  outlineColor: Cesium.Color.WHITE,
  ellipseSemiAxis: 20.0,
  ellipseAlpha: 0.3,
};

// 聚焦标记配置
export const FOCUS_MARKER_CONFIG = {
  pointSize: 20,
  pointColor: Cesium.Color.YELLOW,
  outlineWidth: 3,
  outlineColor: Cesium.Color.WHITE,
  ellipseSemiAxis: 30.0,
  ellipseAlpha: 0.4,
};

// LOD (Level of Detail) 配置
export const LOD_CONFIG = {
  // 远距离阈值：超过此距离显示为点（米）
  farThreshold: 21,
  // 近距离阈值：小于此距离显示详细内容（米）
  nearThreshold: 20,
  // 点的大小配置
  dotSize: 72,
  dotPadding: 2,
};

// 音频播放配置
export const AUDIO_CONFIG = {
  // 音频开始播放的距离（米）
  playDistance: 15,
  // 音频停止播放的距离（米，添加滞后避免频繁切换）
  stopDistance: 20,
  // 最大音量距离（米，此距离内音量为1）
  maxVolumeDistance: 5,
  // 音量衰减曲线类型：'linear'（线性）或 'exponential'（指数）
  volumeCurve: "exponential",
  // 更新频率（毫秒）
  updateInterval: 500,
};
