const ARContentRenderer = require("../../utils/arContentRenderer.js");

Component({
  properties: {
    assets: {
      type: Array,
      value: [],
    },
    userLocation: {
      type: Object,
      value: null,
    },
  },

  data: {
    loaded: false,
    arReady: false,
    isDevtools: false,
  },

  lifetimes: {
    attached() {
      console.log("xr-ar-scene component attached");

      // 检测是否在开发者工具中运行
      const systemInfo = wx.getSystemInfoSync();
      const isDevtools = systemInfo.platform === "devtools";
      this.setData({ isDevtools });

      if (isDevtools) {
        console.warn("⚠️ AR功能在开发者工具中不可用，请使用真机预览");
      }
    },
  },

  methods: {
    handleReady({ detail }) {
      const xrScene = (this.scene = detail.value);
      console.log("xr-scene ready", xrScene);

      // 获取内容根节点
      const contentRoot = xrScene.getNodeById("ar-content-root");
      console.log("contentRoot:", contentRoot, "type:", typeof contentRoot);

      if (!contentRoot) {
        console.error("❌ Failed to get ar-content-root node!");
      } else {
        console.log(
          "✅ Got ar-content-root, has addChild:",
          typeof contentRoot.addChild
        );
      }

      // 初始化内容渲染器
      this.contentRenderer = new ARContentRenderer(xrScene);
      this.contentRenderer.setContentRoot(contentRoot);

      // 通知父组件场景已就绪
      this.triggerEvent("sceneReady", {
        scene: xrScene,
        renderer: this.contentRenderer,
      });

      // 如果没有外部资产需要加载，直接触发assetsLoaded
      // 等待一小段时间确保xr-assets有机会触发loaded事件
      setTimeout(() => {
        if (!this.data.loaded) {
          console.log("✅ No external assets to load, marking as loaded");
          this.setData({ loaded: true });
          this.triggerEvent("assetsLoaded");
        }
      }, 100);
    },

    handleAssetsProgress({ detail }) {
      console.log("assets progress", detail.value);
    },

    handleAssetsLoaded({ detail }) {
      console.log("assets loaded", detail.value);
      this.setData({ loaded: true });
      this.triggerEvent("assetsLoaded");
    },

    handleARReady({ detail }) {
      console.log("AR ready, version:", this.scene.ar?.arVersion);
      this.setData({ arReady: true });
      this.triggerEvent("arReady");
    },

    handleTick({ detail }) {
      const delta = detail.value;

      // 更新内容动画
      if (this.contentRenderer) {
        this.contentRenderer.updateAnimations(delta);
      }
    },

    // 对外暴露的方法
    clearContent() {
      if (this.contentRenderer) {
        this.contentRenderer.clearAll();
      }
    },

    renderAssets(assets, userLocation) {
      console.log("🎨 [Component] renderAssets called");
      console.log("  contentRenderer:", this.contentRenderer);
      console.log("  assets:", assets);
      console.log("  userLocation:", userLocation);

      if (!this.contentRenderer || !assets || assets.length === 0) {
        console.warn("⚠️ Cannot render: missing contentRenderer or assets");
        return;
      }

      console.log(`🎨 Rendering ${assets.length} assets...`);

      assets.forEach((asset) => {
        console.log(`📍 Processing asset ${asset.id} (${asset.file_type})`);
        console.log("  metadata:", asset.metadata);

        if (!asset.metadata?.latitude || !asset.metadata?.longitude) {
          console.warn(`⚠️ Asset ${asset.id} missing location data`);
          return;
        }

        const relativePosition = this.calculateRelativePosition(userLocation, {
          latitude: asset.metadata.latitude,
          longitude: asset.metadata.longitude,
          altitude: asset.metadata.altitude || 0,
        });

        console.log(
          `📍 Asset ${asset.id} at relative position:`,
          relativePosition
        );

        switch (asset.file_type) {
          case "image":
            this.contentRenderer.renderImage(asset, relativePosition);
            break;
          case "text":
            this.contentRenderer.renderText(asset, relativePosition);
            break;
          case "audio":
            this.contentRenderer.renderAudio(asset, relativePosition);
            break;
          default:
            console.warn(`⚠️ Unknown asset type: ${asset.file_type}`);
        }
      });

      console.log("✅ Rendering complete");
    },

    calculateRelativePosition(userLocation, assetLocation) {
      const R = 6371000;

      const lat1 = (userLocation.latitude * Math.PI) / 180;
      const lat2 = (assetLocation.latitude * Math.PI) / 180;
      const dLat =
        ((assetLocation.latitude - userLocation.latitude) * Math.PI) / 180;
      const dLon =
        ((assetLocation.longitude - userLocation.longitude) * Math.PI) / 180;

      const x = dLon * R * Math.cos((lat1 + lat2) / 2);
      const z = -dLat * R;
      const y = (assetLocation.altitude || 0) - (userLocation.altitude || 0);

      return { x, y: y + 1.5, z };
    },
  },
});
