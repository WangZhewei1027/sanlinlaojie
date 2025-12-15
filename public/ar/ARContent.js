/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * AR内容组件
 * 创建和管理AR场景中的3D内容
 */
class ARContent {
  constructor() {
    this.group = new THREE.Group();
    this.userLocation = null;
    this.lastUpdateLocation = null; // 上次更新时的位置
    this.assets = [];
    this.assetMeshes = [];
    this.rotationSpeed = 0.005; // 旋转速度
    this.radius = 1.2; // 旋转半径（米）
    this.UPDATE_DISTANCE_THRESHOLD = 10; // 移动10米才更新（米）

    // 初始化资产服务
    this.assetService = new AssetService();

    // 初始化中心对象
    this.centerObject = new CenterObject();

    this.init();
    this.startAssetUpdates();
  }

  /**
   * 初始化3D内容
   */
  init() {
    // 添加中心对象到场景
    this.group.add(this.centerObject.getObject3D());
  }

  /**
   * 更新动画
   */
  update() {
    // 更新中心对象
    this.centerObject.update();

    // 更新素材围绕中心对象旋转
    this.updateAssetRotation();
  }

  /**
   * 开始定时更新素材（基于位置变化）
   */
  startAssetUpdates() {
    // 立即获取一次
    this.updateAssets();

    // 每2秒检查一次位置是否变化超过阈值
    setInterval(() => {
      this.checkLocationAndUpdate();
    }, 2000);
  }

  /**
   * 检查位置变化并决定是否更新素材
   */
  async checkLocationAndUpdate() {
    try {
      // 获取当前位置
      const currentLocation = await this.assetService.getUserLocation();

      // 如果是第一次或没有上次位置记录，直接返回
      if (!this.lastUpdateLocation) {
        return;
      }

      // 计算距离上次更新位置的距离
      const distance = this.calculateDistance(
        this.lastUpdateLocation,
        currentLocation
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
      // 初始角度分布
      const angle = (index / this.assets.length) * Math.PI * 2;

      let mesh;
      if (asset.file_type === "image") {
        mesh = this.createImageMesh(asset, angle);
      } else if (asset.file_type === "text") {
        mesh = this.createTextMesh(asset, angle);
      } else {
        console.warn(`⚠️ Unknown asset type: ${asset.file_type}`);
        return;
      }

      if (mesh) {
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
  createImageMesh(asset, angle) {
    return ImageMeshCreator.create(asset, angle);
  }

  /**
   * 创建文字mesh（使用TextMeshCreator）
   */
  createTextMesh(asset, angle) {
    return TextMeshCreator.create(asset, angle);
  }

  /**
   * 更新素材旋转动画
   */
  updateAssetRotation() {
    this.assetMeshes.forEach((mesh) => {
      // 更新角度
      mesh.userData.angle += this.rotationSpeed;

      // 计算位置（围绕中心对象旋转）
      const centerPos = this.centerObject.getPosition();
      const x = Math.cos(mesh.userData.angle) * this.radius;
      const z = Math.sin(mesh.userData.angle) * this.radius;
      const y = centerPos.y; // 与中心对象同高

      mesh.position.set(x, y, z);

      // 让图片面向摄像机（anchor原点方向）
      mesh.lookAt(0, 0, 0);
    });
  }

  /**
   * 清除旧素材
   */
  clearAssets() {
    this.assetMeshes.forEach((mesh) => {
      this.group.remove(mesh);
      if (mesh.material.map) {
        mesh.material.map.dispose();
      }
      mesh.material.dispose();
      mesh.geometry.dispose();
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
