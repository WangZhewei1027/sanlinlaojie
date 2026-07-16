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

import { CESIUM_ION_TOKEN } from "./src/utils/config.js";
import { initViewer, resetCamera } from "./src/managers/viewerManager.js";
import { setupRecovery } from "./src/managers/recoveryManager.js";
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

    // 4. 延迟加载 3D Tiles（确保 DOM 已准备好）
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
  }
}

/**
 * 重置相机到默认位置（全局函数）
 */
window.resetCamera = function () {
  const tileset = getTileset();
  resetCamera(tileset);
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
