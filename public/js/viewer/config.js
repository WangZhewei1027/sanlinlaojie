/**
 * Cesium Viewer 配置模块
 */

// Cesium Ion token (使用默认 token，生产环境需要自己的 token)
export const CESIUM_ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhOGY2YWFlOC01YWRlLTRlMTAtYmEwZC1hY2YyYTc3YTZmYmMiLCJpZCI6MzY3ODkyLCJpYXQiOjE3NjUyNTg2OTJ9.QOxskQVs1h4gUDRB7c_VvaBniXIgwuronD6__ZiPY_U";

// 元数据配置
export const METADATA = {
  srs: "EPSG:32651", // WGS 84 / UTM zone 51N
  origin: {
    easting: 356865.71708580491,
    northing: 3446141.014862847,
    altitude: 75.355000000997293,
  },
};

// 3D Tiles 配置
export const TILESET_CONFIG = {
  url: "./terra_b3dms/tileset.json",
  options: {
    maximumScreenSpaceError: 2,
    skipLevelOfDetail: false,
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
  focusHeight: 200, // 聚焦时相机高度偏移（米）
  flyDuration: 2.0, // 飞行动画时长（秒）
};

// Billboard 配置
export const BILLBOARD_CONFIG = {
  scale: 0.5, // 图标默认缩放
  imageScale: 2, // 图片类型billboard的缩放（更大以便看清）
  textScale: 5, // 文本类型billboard的缩放
  anchorScale: 6.0, // 锚点类型billboard的缩放
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
