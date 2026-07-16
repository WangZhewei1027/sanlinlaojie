/**
 * WebGL 上下文丢失 / 渲染错误自动恢复模块
 *
 * iOS Safari 在 GPU 内存吃紧或页内刷新时会杀掉 WebGL 上下文，
 * Cesium 默认行为是停止渲染并弹出错误面板。这里改为自动重载页面：
 * 父窗口（useViewerMessaging）会在 iframe load 后重发 origin 和 assets，
 * 所以重载即可完整恢复。用 sessionStorage 限制重试次数避免死循环。
 */

const RELOAD_COUNT_KEY = "viewer-auto-reload-count";
const MAX_AUTO_RELOADS = 3;
// 存活超过该时长视为健康，清零重试计数
const HEALTHY_AFTER_MS = 15000;
// 重载前等待，给 iOS 时间释放已丢失的旧上下文
const RELOAD_DELAY_MS = 1500;

let recovering = false;

/**
 * 注册渲染错误 / 上下文丢失的自动恢复
 * @param {Cesium.Viewer} viewer
 */
export function setupRecovery(viewer) {
  setTimeout(
    () => sessionStorage.removeItem(RELOAD_COUNT_KEY),
    HEALTHY_AFTER_MS,
  );

  viewer.scene.renderError.addEventListener((_scene, error) => {
    recover(`renderError: ${error?.message ?? error}`);
  });

  viewer.scene.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    recover("webglcontextlost");
  });

  // 页面卸载（含页内刷新）时主动销毁并释放上下文，
  // 否则 iOS Safari 刷新后旧上下文未释放，新页面会拿到注定被杀的上下文
  window.addEventListener("pagehide", () => releaseContext(viewer));
}

function recover(reason) {
  if (recovering) return;
  recovering = true;
  console.warn("渲染中断，尝试自动恢复:", reason);

  const count = Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0");
  if (count >= MAX_AUTO_RELOADS) {
    showOverlay("地图渲染多次中断，请关闭其他标签页后重新打开浏览器再试");
    return;
  }
  sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  showOverlay("地图渲染中断，正在自动恢复…", true);
  setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
}

function releaseContext(viewer) {
  try {
    const canvas = viewer.scene.canvas;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    viewer.destroy();
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // 卸载路径，忽略一切异常
  }
}

function showOverlay(text, spinner = false) {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.remove("hidden");
  el.innerHTML = `<div>${text}</div>${spinner ? '<div class="spinner"></div>' : ""}`;
}
