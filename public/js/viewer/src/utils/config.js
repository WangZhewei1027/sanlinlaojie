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
    // GPS 坐标（经纬度），默认上海中心大厦，organization.map_center 到达后覆盖
    lat: 31.2336,
    lng: 121.5057,
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

// 移动端检测：UA 匹配 iOS/Android 等，
// 再用「主输入是触摸」兜底（iPadOS 13+ 的 UA 伪装成 Mac）；
// ?forceMobile 用于在桌面浏览器调试移动端行为
export const IS_MOBILE =
  /iPad|iPhone|iPod|Android|Mobile|HarmonyOS/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 &&
    window.matchMedia("(pointer: coarse)").matches) ||
  new URLSearchParams(window.location.search).has("forceMobile");

// ?sse=N 临时覆盖瓦片精度，用于现场对比画质与流量（不改默认值）
const sseParam = Number(
  new URLSearchParams(window.location.search).get("sse")
);
const sse = (fallback) =>
  Number.isFinite(sseParam) && sseParam > 0 ? sseParam : fallback;

// 3D Tiles 配置
// 移动端 GPU 内存有限，超限会直接杀掉 WebGL 上下文（导致渲染中断），
// 因此用更保守的精度和瓦片缓存
export const TILESET_CONFIG = {
  url: "./terra_b3dms/tileset.json",
  options: IS_MOBILE
    ? {
        maximumScreenSpaceError: sse(16),
        dynamicScreenSpaceError: true,
        skipLevelOfDetail: true,
        cacheBytes: 64 * 1024 * 1024,
        maximumCacheOverflowBytes: 32 * 1024 * 1024,
      }
    : {
        // 瓦片的 geometricError 逐级减半，所以 maxSSE 放大 k 倍 = 少下探 log2(k) 级。
        // 原值 2 会一路拉到 L22（这一层单独就有 1.1 GB）；8 相当于粗两级，
        // 落在 L20 附近，管理台的建筑/街道辨识度足够。
        maximumScreenSpaceError: sse(8),
        // 远处瓦片放宽精度：斜视整条街时省掉大量地平线附近的细节
        dynamicScreenSpaceError: true,
        skipLevelOfDetail: true,
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
  contextOptions: {
    webgl: {
      // iPad/iPhone Safari 在 Cesium 默认的 "high-performance" 下可能返回
      // 缺少 ALIASED_LINE_WIDTH_RANGE 的 WebGL 上下文，导致
      // "null is not an object (evaluating 'u[0]')" 构造失败
      powerPreference: "default",
      // 移动端关掉画布多重采样，省一块全屏抗锯齿缓冲的显存
      ...(IS_MOBILE ? { antialias: false } : {}),
    },
  },
  // 移动端去掉天空盒/大气/MSAA，显存优先保证地形和底图
  ...(IS_MOBILE ? { skyBox: false, skyAtmosphere: false, msaaSamples: 1 } : {}),
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
