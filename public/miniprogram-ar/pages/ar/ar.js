// pages/ar/ar.js
const AssetService = require("../../utils/assetService.js");
const LocationManager = require("../../utils/locationManager.js");

Page({
  data: {
    // 屏幕尺寸
    width: 300,
    height: 300,
    renderWidth: 300,
    renderHeight: 300,

    // UI状态
    statusText: "",
    loading: false,
    loadingText: "加载中...",

    // 模式选择
    fetchModes: [
      { value: "nearby", label: "📍 附近素材" },
      { value: "nearestAnchor", label: "🎯 最近Anchor" },
      { value: "anchor", label: "🔗 指定Anchor" },
    ],
    fetchModeIndex: 0,
    fetchMode: "nearby",

    // Anchor列表
    anchors: [],
    anchorIndex: 0,
    selectedAnchorId: null,

    // AR状态
    arReady: false,
    assetsLoaded: false,

    // 场景对象
    scene: null,
    xrSceneComponent: null,

    // 当前素材列表
    currentAssets: [],

    // 配置
    MAX_DISTANCE: 50, // 最大显示距离（米）
  },

  onLoad: function (options) {
    console.log("AR page loaded", options);

    // 获取系统信息并设置分辨率
    const info = wx.getSystemInfoSync();
    const width = info.windowWidth;
    const height = info.windowHeight;
    const dpi = info.pixelRatio;

    this.setData({
      width,
      height,
      renderWidth: width * dpi,
      renderHeight: height * dpi,
    });

    console.log(
      `📱 Screen: ${width}x${height}, DPI: ${dpi}, Render: ${width * dpi}x${
        height * dpi
      }`
    );

    // 请求相机权限
    this.requestCameraAuth();

    // 初始化服务
    this.assetService = new AssetService();
    this.locationManager = new LocationManager();

    // 设置位置变化回调
    this.locationManager.onLocationChange(async () => {
      console.log("📍 Location changed, updating assets...");
      await this.updateAssets();
    });
  },

  // 请求相机权限
  requestCameraAuth: function () {
    wx.authorize({
      scope: "scope.camera",
      success: () => {
        console.log("✅ Camera permission granted");
      },
      fail: (err) => {
        console.warn("⚠️ Camera permission denied:", err);
        // 引导用户打开设置
        wx.showModal({
          title: "需要相机权限",
          content: "AR功能需要使用相机，请在设置中开启相机权限",
          confirmText: "去设置",
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          },
        });
      },
    });
  },

  onReady: function () {
    console.log("AR page ready");
  },

  onShow: function () {
    console.log("AR page show");

    // 启动位置追踪
    this.locationManager.startTracking();
    this.locationManager.startPeriodicCheck();

    // 如果AR已经就绪，尝试更新资产
    if (this.data.arReady && this.data.assetsLoaded) {
      console.log("🔄 Page shown, refreshing assets...");
      this.updateAssets();
    }
  },

  onHide: function () {
    console.log("AR page hide");

    // 停止位置追踪
    this.locationManager.stopTracking();
  },

  onUnload: function () {
    console.log("AR page unload");

    // 清理资源
    this.locationManager.stopTracking();
  },

  // XR场景组件就绪
  handleSceneReady: function ({ detail }) {
    console.log("XR scene component ready", detail);
    this.scene = detail.scene;
    this.contentRenderer = detail.renderer;
    this.xrSceneComponent = this.selectComponent("#xr-scene");

    console.log("✅ Scene:", this.scene);
    console.log("✅ Renderer:", this.contentRenderer);
    console.log("✅ Component:", this.xrSceneComponent);

    // 加载Anchor列表
    this.loadAnchors();
  },

  // 资源加载完成
  handleAssetsLoaded: function () {
    console.log("Assets loaded in page");
    this.setData({ assetsLoaded: true });

    // 如果AR已经就绪，立即加载素材
    if (this.data.arReady) {
      console.log("✅ AR already ready, loading assets now");
      this.updateAssets();
    } else {
      console.log("⏳ Waiting for AR to be ready...");
    }
  },

  // AR准备就绪
  handleARReady: function () {
    console.log("AR ready in page");
    this.setData({
      arReady: true,
      statusText: "AR已就绪，正在加载资产...",
    });

    // AR就绪后立即获取资产
    this.updateAssets();
  },

  // 加载Anchor列表
  async loadAnchors() {
    try {
      this.setData({ loading: true, loadingText: "加载Anchor列表..." });

      const anchors = await this.assetService.fetchAnchors();

      this.setData({
        anchors:
          anchors.length > 0 ? anchors : [{ id: null, name: "暂无Anchor" }],
        loading: false,
      });

      console.log(`✅ Loaded ${anchors.length} anchors`);
    } catch (error) {
      console.error("❌ Failed to load anchors:", error);
      this.setData({
        anchors: [{ id: null, name: "加载失败" }],
        loading: false,
      });
    }
  },

  // 更新素材
  async updateAssets() {
    console.log("🔄 updateAssets called");
    console.log("  arReady:", this.data.arReady);
    console.log("  assetsLoaded:", this.data.assetsLoaded);
    console.log("  xrSceneComponent:", this.xrSceneComponent);
    console.log("  contentRenderer:", this.contentRenderer);

    // 只需要AR就绪即可
    if (!this.data.arReady) {
      console.log("⏳ Waiting for AR to be ready...");
      return;
    }

    // 需要渲染器就绪
    if (!this.contentRenderer) {
      console.log("⏳ Waiting for content renderer to be ready...");
      return;
    }

    try {
      this.setData({ loading: true, loadingText: "加载素材..." });

      // 获取用户位置
      const userLocation = await this.locationManager.getUserLocation();
      console.log("📍 User location:", userLocation);

      // 根据模式获取素材
      const fetchOptions = {
        mode: this.data.fetchMode,
        userLocation: userLocation,
        anchorId: this.data.selectedAnchorId,
      };
      console.log("🔍 Fetch options:", fetchOptions);

      const assets = await this.assetService.fetchAssets(fetchOptions);

      console.log(`📦 Fetched ${assets.length} assets:`, assets);

      // 清除现有内容
      this.clearARContent();

      // 渲染新素材
      this.renderAssets(assets, userLocation);

      this.setData({
        currentAssets: assets,
        loading: false,
        statusText: `已加载 ${assets.length} 个素材`,
      });

      // 隐藏状态提示
      setTimeout(() => {
        this.setData({ statusText: "" });
      }, 2000);
    } catch (error) {
      console.error("❌ Error updating assets:", error);
      this.setData({
        loading: false,
        statusText: "加载失败",
      });

      setTimeout(() => {
        this.setData({ statusText: "" });
      }, 2000);
    }
  },

  // 清除AR内容
  clearARContent() {
    if (this.contentRenderer) {
      this.contentRenderer.clearAll();
    }
    console.log("🗑️ AR content cleared");
  },

  // 渲染素材到AR场景
  renderAssets(assets, userLocation) {
    console.log("🎨 renderAssets called");
    console.log("  assets count:", assets?.length);
    console.log("  userLocation:", userLocation);
    console.log("  xrSceneComponent:", this.xrSceneComponent);

    if (!assets || assets.length === 0) {
      console.log("⚠️ No assets to render");
      return;
    }

    if (!this.xrSceneComponent) {
      console.error("❌ xrSceneComponent not available!");
      return;
    }

    console.log("✅ Calling xrSceneComponent.renderAssets...");
    this.xrSceneComponent.renderAssets(assets, userLocation);
  },

  // 模式切换
  onFetchModeChange: function (e) {
    const index = e.detail.value;
    const mode = this.data.fetchModes[index].value;

    console.log(`🔄 Fetch mode changed to: ${mode}`);

    this.setData({
      fetchModeIndex: index,
      fetchMode: mode,
      selectedAnchorId: null,
      anchorIndex: 0,
    });

    // 切换模式后重新获取素材
    this.updateAssets();
  },

  // Anchor选择
  onAnchorChange: function (e) {
    const index = e.detail.value;
    const anchor = this.data.anchors[index];

    console.log(`📍 Anchor selected:`, anchor);

    this.setData({
      anchorIndex: index,
      selectedAnchorId: anchor.id,
    });

    // 选择Anchor后重新获取素材
    if (anchor.id) {
      this.updateAssets();
    }
  },

  // 重置AR场景
  handleReset: function () {
    console.log("🔄 Resetting AR scene");

    // 重置AR平面追踪
    if (this.scene && this.scene.ar) {
      this.scene.ar.resetPlane();
    }

    // 重新加载素材
    this.updateAssets();

    this.setData({ statusText: "已重置" });

    setTimeout(() => {
      this.setData({ statusText: "" });
    }, 1500);
  },
});
