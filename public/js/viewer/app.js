/**
 * Cesium 3D Viewer 主应用
 *
 * 功能模块:
 * - config.js: 配置管理
 * - coordinateUtils.js: 坐标转换
 * - viewerManager.js: Viewer管理和相机控制
 * - assetManager.js: 资产显示和管理
 * - messageHandler.js: 跨窗口通信
 * - clickHandler.js: 地图点击事件
 * - tilesetLoader.js: 3D Tiles加载
 */

import { CESIUM_ION_TOKEN, IS_MOBILE } from "./src/utils/config.js";
import {
  initViewer,
  resetCamera,
  flyToOrigin,
} from "./src/managers/viewerManager.js";
import {
  setupRecovery,
  waitForHealthyWebgl,
  recoverFromFatal,
} from "./src/managers/recoveryManager.js";
import { setupMessageListener } from "./src/managers/messageHandler.js";
import { setupClickHandler } from "./src/managers/clickHandler.js";
import {
  setupInteraction,
  setMode,
} from "./src/managers/interactionManager.js";
import { load3DTiles, getTileset } from "./src/managers/tilesetLoader.js";

// 设置 Cesium Ion token
Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

/**
 * 初始化应用
 */
async function init() {
  try {
    // 0. iOS Safari 崩溃后的冷却期内新建上下文必死，先探测等待
    if (!(await waitForHealthyWebgl())) return;

    // 1. 初始化 Viewer
    const viewer = initViewer();

    // 1.5 注册渲染错误 / WebGL 上下文丢失自动恢复（iOS Safari）
    setupRecovery(viewer);

    // 2. 设置消息监听
    setupMessageListener();

    // 3. 设置点击事件处理
    setupClickHandler();

    // 3.5 设置拖动/框选交互
    setupInteraction();

    // 4. 加载地形：移动端显存有限，不加载 b3dm，只用卫星底图
    if (IS_MOBILE) {
      console.log("移动端：跳过 b3dm 地形加载，仅显示卫星底图");
      document.getElementById("loading")?.classList.add("hidden");
      flyToOrigin();
      console.log("应用初始化完成");
      return;
    }

    // 桌面端延迟加载 3D Tiles（确保 DOM 已准备好）
    setTimeout(async () => {
      try {
        await load3DTiles();
        console.log("应用初始化完成");
      } catch (error) {
        console.error("3D Tiles 加载失败:", error);
      }
    }, 1000);
  } catch (error) {
    console.error("应用初始化失败:", error);
    // 构造阶段崩溃（如上下文创建即 lost）同样走限次自动恢复
    recoverFromFatal(error);
  }
}

/**
 * 重置相机到默认位置（全局函数）
 */
window.resetCamera = function () {
  const tileset = getTileset();
  if (tileset) {
    resetCamera(tileset);
  } else {
    // 移动端无地形，重置视角即回到 origin
    flyToOrigin();
  }
};

/**
 * 切换交互模式（全局函数，供工具栏按钮调用）
 * @param {"pan"|"move"|"box"} mode
 */
window.setViewerMode = function (mode) {
  setMode(mode);
  // 更新工具栏按钮 active 态
  document.querySelectorAll("#toolbar .tool-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
};

// 启动应用
init();
