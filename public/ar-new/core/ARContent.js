/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * AR内容组件（主协调器）
 * 协调位置管理器和素材管理器
 */
class ARContent {
  constructor(camera) {
    this.camera = camera;
    this.clock = new THREE.Clock();

    // 初始化子模块
    this.assetService = new AssetService();
    this.locationManager = new LocationManager();
    this.assetManager = new AssetManager(this.assetService, camera);

    this.init();
    this.startAssetUpdates();
  }

  /**
   * 初始化
   */
  init() {
    // 设置位置变化回调
    this.locationManager.onLocationChange(async () => {
      await this.updateAssets();
    });
  }

  /**
   * 开始定时更新素材（基于位置变化）
   */
  startAssetUpdates() {
    // 立即获取一次
    this.updateAssets();

    // 启动位置监听
    this.locationManager.startTracking();

    // 启动定期检查
    this.locationManager.startPeriodicCheck();
  }

  /**
   * 更新素材
   */
  async updateAssets() {
    try {
      // 获取用户位置
      const userLocation = await this.assetService.getUserLocation();

      // 更新素材管理器
      await this.assetManager.updateAssets(userLocation);

      // 标记位置已更新
      this.locationManager.markLocationUpdated();
    } catch (error) {
      console.error("❌ Error updating assets:", error);
      throw error;
    }
  }

  /**
   * 更新动画（在渲染循环中调用）
   */
  update() {
    const delta = this.clock.getDelta();
    this.assetManager.updateAnimations(delta);
  }

  /**
   * 获取Three.js Group对象，用于添加到场景中
   * @returns {THREE.Group}
   */
  getObject3D() {
    return this.assetManager.getGroup();
  }
}
