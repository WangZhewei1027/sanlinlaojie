/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * AR内容组件
 * 创建和管理AR场景中的3D内容
 */
class ARContent {
  constructor(camera) {
    this.group = new THREE.Group();
    this.camera = camera; // 存储摄像机引用用于空间音频
    this.userLocation = null;
    this.currentLocation = null; // 当前位置（实时更新）
    this.lastUpdateLocation = null; // 上次更新时的位置
    this.assets = [];
    this.assetMeshes = [];
    this.minDistance = 2; // 最小距离（米）
    this.maxDistance = 5; // 最大距离（米）
    this.eyeLevel = 1.6; // 视平线高度（米）
    this.UPDATE_DISTANCE_THRESHOLD = 10; // 移动10米才更新（米）
    this.clock = new THREE.Clock(); // 用于呼吸动画

    // 初始化资产服务
    this.assetService = new AssetService();

    this.init();
    this.startAssetUpdates();
  }

  /**
   * 初始化3D内容
   */
  init() {
    // 不需要中心对象
  }

  /**
   * 更新动画
   */
  update() {
    const delta = this.clock.getDelta();

    // 更新所有音频mesh的呼吸动画
    this.assetMeshes.forEach((mesh) => {
      if (mesh.userData.assetType === "audio") {
        AudioMeshCreator.updateBreathingAnimation(mesh, delta);
      }
    });
  }

  /**
   * 开始定时更新素材（基于位置变化）
   */
  startAssetUpdates() {
    // 立即获取一次
    this.updateAssets();

    // 启动位置监听
    this.startLocationTracking();

    // 每2秒检查一次位置是否变化超过阈值
    setInterval(() => {
      this.checkLocationAndUpdate();
    }, 2000);
  }

  /**
   * 启动位置持续监听
   */
  startLocationTracking() {
    if (!navigator.geolocation) {
      console.error("❌ Geolocation not supported");
      return;
    }

    // 使用watchPosition持续监听位置变化
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
        };
        console.log(
          `📍 Location updated: ${this.currentLocation.latitude.toFixed(
            6
          )}, ${this.currentLocation.longitude.toFixed(6)}`
        );
      },
      (error) => {
        console.error("❌ Location tracking error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000, // 允许5秒的缓存
      }
    );
  }

  /**
   * 检查位置变化并决定是否更新素材
   */
  async checkLocationAndUpdate() {
    try {
      // 使用watchPosition更新的currentLocation
      if (!this.currentLocation) {
        console.log("⏳ Waiting for location...");
        return;
      }

      // 如果是第一次或没有上次位置记录，直接返回
      if (!this.lastUpdateLocation) {
        return;
      }

      // 计算距离上次更新位置的距离
      const distance = this.calculateDistance(
        this.lastUpdateLocation,
        this.currentLocation
      );

      console.log(`📏 Distance moved: ${distance.toFixed(2)}m`);

      // 如果移动距离超过阈值，更新素材
      if (distance >= this.UPDATE_DISTANCE_THRESHOLD) {
        console.log(`🚶 Moved ${distance.toFixed(2)}m, updating assets...`);
        this.updateAssets();
      }
    } catch (error) {
      console.error("❌ Error checking location:", error);
    }
  }

  /**
   * 计算两个GPS坐标之间的距离（米）
   * 使用Haversine公式
   */
  calculateDistance(loc1, loc2) {
    const R = 6371000; // 地球半径（米）
    const lat1 = (loc1.latitude * Math.PI) / 180;
    const lat2 = (loc2.latitude * Math.PI) / 180;
    const deltaLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const deltaLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * 更新素材
   */
  async updateAssets() {
    try {
      console.log("🔄 Updating assets...");

      // 获取用户位置
      this.userLocation = await this.assetService.getUserLocation();
      console.log(
        `📍 User location: ${this.userLocation.latitude.toFixed(
          6
        )}, ${this.userLocation.longitude.toFixed(6)}`
      );

      // 使用PostGIS获取附近的素材
      const nearbyAssets = await this.assetService.fetchNearbyAssets(
        this.userLocation
      );

      console.log(
        `🎯 Found ${nearbyAssets.length} assets within ${this.assetService.MAX_DISTANCE}m`
      );

      // 清除旧的素材
      this.clearAssets();

      // 创建新的素材
      this.assets = nearbyAssets;
      this.createAssetMeshes();

      // 保存当前位置作为上次更新位置
      this.lastUpdateLocation = { ...this.userLocation };
    } catch (error) {
      console.error("❌ Error updating assets:", error);
    }
  }

  /**
   * 创建素材网格
   */
  createAssetMeshes() {
    this.assets.forEach((asset, index) => {
      // 随机生成位置和朝向
      const position = this.generateRandomPosition();
      const rotation = this.generateRandomRotation();

      let mesh;
      if (asset.file_type === "image") {
        mesh = this.createImageMesh(asset, position, rotation);
      } else if (asset.file_type === "text") {
        mesh = this.createTextMesh(asset, position, rotation);
      } else if (asset.file_type === "audio") {
        mesh = this.createAudioMesh(asset, position, rotation);
      } else {
        console.warn(`⚠️ Unknown asset type: ${asset.file_type}`);
        return;
      }

      if (mesh) {
        // 设置位置和旋转
        mesh.position.set(position.x, position.y, position.z);
        mesh.rotation.y = rotation;

        this.group.add(mesh);
        this.assetMeshes.push(mesh);
      } else {
        console.error(`❌ Failed to create mesh for asset ${asset.id}`);
      }
    });
  }

  /**
   * 创建图片mesh（使用ImageMeshCreator）
   */
  createImageMesh(asset, position, rotation) {
    return ImageMeshCreator.create(asset, position, rotation);
  }

  /**
   * 创建文字mesh（使用TextMeshCreator）
   */
  createTextMesh(asset, position, rotation) {
    return TextMeshCreator.create(asset, position, rotation);
  }

  /**
   * 创建音频mesh（使用AudioMeshCreator）
   */
  createAudioMesh(asset, position, rotation) {
    return AudioMeshCreator.create(asset, position, rotation, this.camera);
  }

  /**
   * 生成随机位置（在视平线高度，围绕周围）
   */
  generateRandomPosition() {
    // 随机角度（0-360度）
    const angle = Math.random() * Math.PI * 2;

    // 随机距离（minDistance到maxDistance之间）
    const distance =
      this.minDistance + Math.random() * (this.maxDistance - this.minDistance);

    // 计算位置
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = this.eyeLevel + (Math.random() - 0.5) * 0.4; // 视平线高度，上下浮动20cm

    return { x, y, z };
  }

  /**
   * 生成随机旋转角度
   */
  generateRandomRotation() {
    // 随机旋转（0-360度）
    return Math.random() * Math.PI * 2;
  }

  /**
   * 清除旧素材
   */
  clearAssets() {
    this.assetMeshes.forEach((mesh) => {
      // 如果是音频类型，特殊清理
      if (mesh.userData.assetType === "audio") {
        AudioMeshCreator.dispose(mesh);
      } else {
        // 普通清理
        if (mesh.material) {
          if (mesh.material.map) {
            mesh.material.map.dispose();
          }
          mesh.material.dispose();
        }
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
      }
      this.group.remove(mesh);
    });
    this.assetMeshes = [];
    console.log("🗑️ Cleared old assets");
  }

  /**
   * 获取Three.js Group对象，用于添加到场景中
   */
  getObject3D() {
    return this.group;
  }
}
