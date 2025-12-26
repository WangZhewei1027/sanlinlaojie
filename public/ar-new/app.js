/**
 * AR应用主入口
 * 负责初始化和协调所有组件
 */

// 初始化 VConsole
const vConsole = new window.VConsole();

// 初始化并启动 Splash Screen Remover
const splashRemover = new SplashScreenRemover();
splashRemover.start();

// 获取 DOM 元素
const canvas = document.querySelector("#ar-canvas");
const statusIndicator = document.querySelector("#status-indicator");
const resetButton = document.querySelector("#reset-button");
const fetchModeSelect = document.querySelector("#fetch-mode-select");
const anchorInputContainer = document.querySelector("#anchor-input-container");
const anchorSelect = document.querySelector("#anchor-select");

if (
  !canvas ||
  !statusIndicator ||
  !resetButton ||
  !fetchModeSelect ||
  !anchorInputContainer ||
  !anchorSelect
) {
  throw new Error("Required DOM elements not found");
}

// 1. 创建 Three.js renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// 2. 告诉 Zappar 使用这个 WebGL 上下文
ZapparThree.glContextSet(renderer.getContext());

// 3. 创建 Zappar Camera
const camera = new ZapparThree.Camera();

// 场景 + 把相机背景设为摄像头画面
const scene = new THREE.Scene();
scene.background = camera.backgroundTexture;

// 4. 创建 Instant World Tracker + Anchor Group
const instantWorldTracker = new ZapparThree.InstantWorldTracker();
const instantWorldAnchorGroup = new ZapparThree.InstantWorldAnchorGroup(
  camera,
  instantWorldTracker
);
scene.add(instantWorldAnchorGroup);

// 5. 创建 AR 内容组件（传递摄像机用于空间音频）
const arContent = new ARContent(camera);
instantWorldAnchorGroup.add(arContent.getObject3D());

// 6. 创建设备方向检测器
const orientationChecker = new DeviceOrientationChecker(statusIndicator);

// 7. 加载 Anchor 列表
async function loadAnchors() {
  try {
    console.log("🔄 Loading anchors...");
    const assetService = arContent.assetService;
    const anchors = await assetService.fetchAnchors();

    // 清空现有选项
    anchorSelect.innerHTML = "";

    // 添加默认选项
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "请选择 Anchor";
    anchorSelect.appendChild(defaultOption);

    // 添加 anchor 选项
    anchors.forEach((anchor) => {
      const option = document.createElement("option");
      option.value = anchor.id;
      option.textContent = anchor.name || `Anchor ${anchor.id.substring(0, 8)}`;
      anchorSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${anchors.length} anchors`);
  } catch (error) {
    console.error("❌ Failed to load anchors:", error);
    anchorSelect.innerHTML = '<option value="">加载失败</option>';
  }
}

// 8. 绑定模式选择器事件
fetchModeSelect.addEventListener("change", (e) => {
  const mode = e.target.value;
  console.log(`🔄 Fetch mode changed to: ${mode}`);

  // 显示或隐藏 Anchor 下拉框
  if (mode === "anchor") {
    anchorInputContainer.classList.remove("hidden");
    // 加载 anchor 列表
    loadAnchors();
  } else {
    anchorInputContainer.classList.add("hidden");
  }

  // 更新 AssetManager 的 fetch 模式
  const anchorId = mode === "anchor" ? anchorSelect.value : null;
  arContent.setFetchMode(mode, anchorId);

  // 如果不是 anchor 模式，或者已经选择了 anchor，则自动刷新素材
  if (mode !== "anchor" || anchorId) {
    arContent.updateAssets().catch((error) => {
      console.error("❌ Failed to update assets after mode change:", error);
    });
  }
});

// 9. 绑定 Anchor 下拉框事件
anchorSelect.addEventListener("change", (e) => {
  const anchorId = e.target.value;

  if (fetchModeSelect.value === "anchor") {
    console.log(`🔄 Anchor changed to: ${anchorId}`);
    arContent.setFetchMode("anchor", anchorId);

    // 如果选择了有效的 anchor，自动刷新素材
    if (anchorId) {
      arContent.updateAssets().catch((error) => {
        console.error("❌ Failed to update assets after anchor change:", error);
      });
    }
  }
});

// 10. 绑定Reset按钮
resetButton.addEventListener("click", () => {
  console.log("🔄 Manual refresh triggered");
  resetButton.textContent = "⏳ 重置中...";
  resetButton.disabled = true;

  // 重置方向检测器，重新开始检测流程
  orientationChecker.reset();

  // 设置回调：在放置完成后更新素材
  orientationChecker.onPlaced(() => {
    console.log("📍 Placement completed, now updating assets...");
    arContent
      .updateAssets()
      .then(() => {
        resetButton.textContent = "✅ 已刷新";
        setTimeout(() => {
          resetButton.textContent = "🔄 刷新素材";
          resetButton.disabled = false;
        }, 1500);
      })
      .catch((error) => {
        console.error("❌ Refresh failed:", error);
        resetButton.textContent = "❌ 刷新失败";
        setTimeout(() => {
          resetButton.textContent = "🔄 刷新素材";
          resetButton.disabled = false;
        }, 1500);
      });
  });
});

// 11. 窗口 resize 时更新画布大小
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 11. 渲染循环
function animate() {
  requestAnimationFrame(animate);

  // 更新相机的帧（把最新摄像头画面塞进背景纹理）
  camera.updateFrame(renderer);

  // 如果还没放置，持续更新anchor位置到与视线齐平的水平前方
  // Y=0 保持与相机同高度（人眼高度），Z=-5 表示前方5米
  if (!orientationChecker.isPlaced()) {
    instantWorldTracker.setAnchorPoseFromCameraOffset(0, 0, -5);
  }

  // 更新AR内容组件动画
  arContent.update();

  // 用 Zappar 相机渲染场景
  renderer.render(scene, camera);
}

// 13. 自动启动 AR
function startAR() {
  ZapparThree.permissionRequestUI().then((granted) => {
    if (granted) {
      console.log("✅ Camera permission granted");

      // 开始使用摄像头
      camera.start();

      // 启动设备方向检测
      orientationChecker.start();

      // 开始渲染循环
      animate();

      // 等待 3 秒后再请求其他权限（如 GPS）
      console.log(
        "⏳ Waiting 3 seconds before requesting other permissions..."
      );
      setTimeout(() => {
        requestLocationPermission();
      }, 3000);
    } else {
      // 如果拒绝，就显示 Zappar 提供的默认提示 UI
      ZapparThree.permissionDeniedUI();
    }
  });
}

// 14. 请求位置权限
function requestLocationPermission() {
  console.log("✅ Ready to request additional permissions");

  // 请求 GPS 位置权限
  if (navigator.geolocation) {
    console.log("📍 Requesting location permission...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("✅ Location permission granted");
        console.log(`📍 Latitude: ${position.coords.latitude.toFixed(6)}`);
        console.log(`📍 Longitude: ${position.coords.longitude.toFixed(6)}`);
        console.log(`📍 Altitude: ${position.coords.altitude || 0}m`);
        console.log(`📍 Accuracy: ${position.coords.accuracy}m`);
      },
      (error) => {
        let errorMsg = "";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "用户拒绝了位置权限请求";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "位置信息不可用";
            break;
          case error.TIMEOUT:
            errorMsg = "获取位置超时";
            break;
          default:
            errorMsg = "未知错误";
        }
        console.warn(`⚠️ Location error: ${errorMsg}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  } else {
    console.warn("⚠️ Geolocation not supported by this browser");
  }
}

// 启动应用
startAR();
