/**
 * WebGL 上下文丢失 / 渲染错误自动恢复模块
 *
 * iOS Safari 在 GPU 内存吃紧或页内刷新时会杀掉 WebGL 上下文，
 * Cesium 默认行为是停止渲染并弹出错误面板。这里改为：
 * 1. 出错瞬间销毁 viewer 释放显存，按递增退避延迟后重载页面
 *    （父窗口 useViewerMessaging 会在 iframe load 后重发 origin 和 assets）；
 * 2. 连续崩溃 2 次后降级到 WebGL1，一旦靠 WebGL1 存活则永久记住；
 * 3. sessionStorage 限制重试次数避免死循环。
 */

const RELOAD_COUNT_KEY = "viewer-auto-reload-count";
const PREFER_WEBGL1_KEY = "viewer-prefer-webgl1";
const MAX_AUTO_RELOADS = 4;
// 存活超过该时长视为健康，清零重试计数
const HEALTHY_AFTER_MS = 15000;
// 重载退避基数：第 n 次重试等待 n * 该值，给系统时间回收显存
const RELOAD_BASE_DELAY_MS = 2000;

let recovering = false;

function reloadCount() {
  return Number(sessionStorage.getItem(RELOAD_COUNT_KEY) || "0");
}

/**
 * 是否应改用 WebGL1 初始化：
 * 该设备曾靠 WebGL1 恢复过，或本轮已连续崩溃 2 次
 * @returns {boolean}
 */
export function preferWebgl1() {
  return localStorage.getItem(PREFER_WEBGL1_KEY) === "1" || reloadCount() >= 2;
}

/**
 * 探测 WebGL 是否健康：能创建上下文、未丢失、且能读出
 * ALIASED_LINE_WIDTH_RANGE（iOS 崩溃冷却期内该参数为 null）
 */
function probeWebgl() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const attrs = { powerPreference: "default" };
  const gl =
    canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
  if (!gl) return false;
  const range = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);
  const healthy = !gl.isContextLost() && range != null;
  // 立即释放探测用的上下文，不占用 Safari 的上下文配额
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return healthy;
}

/**
 * 等待 WebGL 恢复健康后再初始化 Cesium。
 * iOS Safari 崩溃后有一段冷却期，期间新建的上下文会立刻 lost，
 * 此时构造 CesiumWidget 必然失败，所以先探测、不健康就等。
 * @returns {Promise<boolean>} 健康返回 true；超时返回 false（已显示提示）
 */
export async function waitForHealthyWebgl(maxWaitMs = 30000, intervalMs = 2000) {
  if (probeWebgl()) return true;

  console.warn("WebGL 尚不可用，等待系统释放显卡资源…");
  showOverlay("正在等待系统释放显卡资源…", true);
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (probeWebgl()) {
      showOverlay("正在初始化地图…", true);
      return true;
    }
  }
  showOverlay(
    "无法启动地图渲染。请关闭其他应用和标签页后，彻底退出浏览器再重新打开",
  );
  return false;
}

/**
 * 初始化阶段的致命错误（如构造 CesiumWidget 失败）也走自动恢复
 * @param {*} reason
 */
export function recoverFromFatal(reason) {
  recover(null, reason);
}

/**
 * 注册渲染错误 / 上下文丢失的自动恢复
 * @param {Cesium.Viewer} viewer
 */
export function setupRecovery(viewer) {
  setTimeout(() => {
    // 本次会话已稳定存活：若是降级 WebGL1 后才活下来的，永久记住
    if (reloadCount() >= 2) {
      localStorage.setItem(PREFER_WEBGL1_KEY, "1");
      console.log("WebGL1 模式下运行稳定，已记住该设备使用 WebGL1");
    }
    sessionStorage.removeItem(RELOAD_COUNT_KEY);
  }, HEALTHY_AFTER_MS);

  viewer.scene.renderError.addEventListener((_scene, error) => {
    recover(viewer, `renderError: ${error?.message ?? error}`);
  });

  viewer.scene.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    recover(viewer, "webglcontextlost");
  });

  // 页面卸载（含页内刷新）时主动销毁并释放上下文，
  // 否则 iOS Safari 刷新后旧上下文未释放，新页面会拿到注定被杀的上下文
  window.addEventListener("pagehide", () => releaseContext(viewer));
}

function recover(viewer, reason) {
  if (recovering) return;
  recovering = true;
  console.warn("渲染中断，尝试自动恢复:", reason);

  const count = reloadCount();
  if (count >= MAX_AUTO_RELOADS) {
    showOverlay(
      "地图渲染多次中断，设备可用内存可能不足。请关闭其他应用和标签页后，彻底退出浏览器再重新打开",
    );
    return;
  }
  sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  showOverlay("地图渲染中断，正在自动恢复…", true);

  // 立即销毁并释放显存（避开当前渲染调用栈），再退避等待系统回收后重载
  setTimeout(() => releaseContext(viewer), 0);
  setTimeout(
    () => window.location.reload(),
    RELOAD_BASE_DELAY_MS * (count + 1),
  );
}

function releaseContext(viewer) {
  if (!viewer) return;
  try {
    const canvas = viewer.scene.canvas;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    viewer.destroy();
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // 释放路径，忽略一切异常（viewer 可能已销毁）
  }
}

function showOverlay(text, spinner = false) {
  const el = document.getElementById("loading");
  if (!el) return;
  el.classList.remove("hidden");
  el.innerHTML = `<div>${text}</div>${spinner ? '<div class="spinner"></div>' : ""}`;
}
