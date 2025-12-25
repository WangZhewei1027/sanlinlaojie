/**
 * 3D Tiles 加载模块
 */

import { TILESET_CONFIG } from "../utils/config.js";
import { getViewer, zoomToTileset } from "./viewerManager.js";

let tileset = null;

/**
 * 更新统计信息
 * @param {number} loaded - 已加载的块数
 * @param {number} total - 总块数
 */
function updateStats(loaded, total) {
  const statsElement = document.getElementById("loadedBlocks");
  if (statsElement) {
    statsElement.textContent = `${loaded}/${total}`;
  }
}

/**
 * 更新加载状态
 * @param {string} status - 状态文本
 */
function updateLoadStatus(status) {
  const statusElement = document.getElementById("loadStatus");
  if (statusElement) {
    statusElement.textContent = status;
  }
}

/**
 * 显示/隐藏加载提示
 * @param {boolean} show - 是否显示
 */
function toggleLoadingIndicator(show) {
  const loadingElement = document.getElementById("loading");
  if (loadingElement) {
    if (show) {
      loadingElement.classList.remove("hidden");
    } else {
      loadingElement.classList.add("hidden");
    }
  }
}

/**
 * 显示加载错误
 * @param {string} errorMessage - 错误消息
 */
function showLoadError(errorMessage) {
  const loadingElement = document.getElementById("loading");
  if (loadingElement) {
    loadingElement.innerHTML = `<div style="color: #ff5252;">加载失败: ${errorMessage}</div>`;
  }
}

/**
 * 加载 3D Tiles
 * @returns {Promise<Cesium.Cesium3DTileset>} - 返回加载的tileset
 */
export async function load3DTiles() {
  const viewer = getViewer();
  if (!viewer) {
    throw new Error("Viewer not initialized");
  }

  try {
    updateLoadStatus("加载中...");
    console.log("开始加载 3D Tiles...");

    // 加载 3D Tiles tileset
    tileset = await Cesium.Cesium3DTileset.fromUrl(
      TILESET_CONFIG.url,
      TILESET_CONFIG.options
    );

    // 添加到场景
    viewer.scene.primitives.add(tileset);
    console.log("3D Tiles 加载成功");

    // 监听加载进度
    setupTileLoadListener();

    // 等待 tileset 准备好
    await tileset.readyPromise;

    updateLoadStatus("已加载");
    toggleLoadingIndicator(false);

    // 飞到 tileset 位置
    zoomToTileset(tileset);

    console.log("视角已调整到地形");

    return tileset;
  } catch (error) {
    console.error("3D Tiles 加载失败:", error);
    updateLoadStatus("加载失败");
    showLoadError(error.message);
    throw error;
  }
}

/**
 * 设置瓦片加载监听器
 */
function setupTileLoadListener() {
  if (!tileset) return;

  let tilesLoaded = 0;
  const totalTiles = TILESET_CONFIG.totalTiles;

  tileset.tileLoad.addEventListener(() => {
    tilesLoaded++;
    updateStats(tilesLoaded, totalTiles);
  });
}

/**
 * 获取当前的 tileset 实例
 * @returns {Cesium.Cesium3DTileset|null}
 */
export function getTileset() {
  return tileset;
}

/**
 * 卸载 tileset
 */
export function unloadTileset() {
  const viewer = getViewer();
  if (!viewer || !tileset) return;

  viewer.scene.primitives.remove(tileset);
  tileset = null;
  console.log("Tileset 已卸载");
}
