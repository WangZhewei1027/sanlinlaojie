// Cesium Ion token (使用默认 token，生产环境需要自己的 token)
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhOGY2YWFlOC01YWRlLTRlMTAtYmEwZC1hY2YyYTc3YTZmYmMiLCJpZCI6MzY3ODkyLCJpYXQiOjE3NjUyNTg2OTJ9.QOxskQVs1h4gUDRB7c_VvaBniXIgwuronD6__ZiPY_U";

// 元数据配置
const metadata = {
  srs: "EPSG:32651", // WGS 84 / UTM zone 51N
  origin: {
    easting: 356865.71708580491,
    northing: 3446141.014862847,
    altitude: 75.355000000997293,
  },
};

let viewer = null;
let tileset = null;

/**
 * UTM Zone 51N 转换为经纬度
 */
function utm51NToWGS84(easting, northing) {
  const zone = 51;
  const centerLon = (zone - 1) * 6 - 180 + 3; // 123°E

  // 简化转换（实际应使用 proj4.js）
  const lat = northing / 110540; // 近似纬度
  const lon = centerLon + easting / (111320 * Math.cos((lat * Math.PI) / 180));

  return Cesium.Cartesian3.fromDegrees(lon, lat, 0);
}

/**
 * 更新统计信息
 */
function updateStats(loaded, total) {
  document.getElementById("loadedBlocks").textContent = `${loaded}/${total}`;
}

/**
 * 初始化 Cesium Viewer
 */
function initViewer() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    timeline: false,
    animation: false,
    baseLayerPicker: true,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    infoBox: false,
  });

  // 确保场景显示正确
  viewer.scene.globe.show = true;
  viewer.scene.globe.depthTestAgainstTerrain = false;

  // 计算并显示原点坐标
  const originCartesian = utm51NToWGS84(
    metadata.origin.easting,
    metadata.origin.northing
  );
  const originCartographic = Cesium.Cartographic.fromCartesian(originCartesian);
  const originLon = Cesium.Math.toDegrees(originCartographic.longitude);
  const originLat = Cesium.Math.toDegrees(originCartographic.latitude);

  console.log(`原点坐标: ${originLon.toFixed(6)}°E, ${originLat.toFixed(6)}°N`);

  // 添加点击事件监听
  setupClickHandler();
}

/**
 * 设置点击事件处理
 */
function setupClickHandler() {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    // 获取点击位置的地球坐标
    const cartesian = viewer.camera.pickEllipsoid(
      movement.position,
      viewer.scene.globe.ellipsoid
    );

    if (cartesian) {
      // 转换为经纬度
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const longitude = Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      // 发送消息给父窗口
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "LOCATION_CLICKED",
            payload: {
              longitude,
              latitude,
              height,
            },
            source: "viewer",
            version: 1,
          },
          "*"
        );
      }

      console.log(
        `点击坐标: ${longitude.toFixed(6)}°, ${latitude.toFixed(
          6
        )}°, ${height.toFixed(2)}m`
      );
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

/**
 * 加载 3D Tiles
 */
async function load3DTiles() {
  try {
    document.getElementById("loadStatus").textContent = "加载中...";
    console.log("开始加载 3D Tiles...");

    // 加载 3D Tiles tileset
    tileset = await Cesium.Cesium3DTileset.fromUrl(
      "./terra_b3dms/tileset.json",
      {
        maximumScreenSpaceError: 2,
        skipLevelOfDetail: false,
        immediatelyLoadDesiredLevelOfDetail: true,
        loadSiblings: true,
        cullWithChildrenBounds: false,
      }
    );

    // 添加到场景
    viewer.scene.primitives.add(tileset);
    console.log("3D Tiles 加载成功");

    // 监听加载进度
    let tilesLoaded = 0;
    const totalTiles = 8;

    tileset.tileLoad.addEventListener(() => {
      tilesLoaded++;
      updateStats(tilesLoaded, totalTiles);
    });

    // 等待 tileset 准备好
    await tileset.readyPromise;

    document.getElementById("loadStatus").textContent = "已加载";
    document.getElementById("loading").classList.add("hidden");

    // 飞到 tileset 位置
    viewer.zoomTo(
      tileset,
      new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-45),
        tileset.boundingSphere.radius * 2
      )
    );

    console.log("视角已调整到地形");
  } catch (error) {
    console.error("3D Tiles 加载失败:", error);
    document.getElementById("loadStatus").textContent = "加载失败";
    document.getElementById(
      "loading"
    ).innerHTML = `<div style="color: #ff5252;">加载失败: ${error.message}</div>`;
  }
}

/**
 * 重置相机
 */
window.resetCamera = function () {
  if (tileset) {
    viewer.zoomTo(
      tileset,
      new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-45),
        tileset.boundingSphere.radius * 2
      )
    );
  }
};

/**
 * 初始化应用
 */
function init() {
  initViewer();
  setTimeout(() => {
    load3DTiles();
  }, 1000);
}

// 启动应用
init();
