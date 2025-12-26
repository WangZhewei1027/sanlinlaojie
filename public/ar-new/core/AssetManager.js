/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 素材管理器
 * 负责管理AR场景中的素材创建、更新和清理
 */
class AssetManager {
  constructor(assetService, camera) {
    this.assetService = assetService;
    this.camera = camera;
    this.group = new THREE.Group();
    this.assets = [];
    this.assetMeshes = [];
    this.minDistance = 2; // 最小距离（米）
    this.maxDistance = 5; // 最大距离（米）
    this.eyeLevel = 1.6; // 视平线高度（米）
  }

  /**
   * 获取Three.js Group对象
   * @returns {THREE.Group}
   */
  getGroup() {
    return this.group;
  }

  /**
   * 从服务器获取附近的素材并创建
   * @param {Object} userLocation - 用户位置 {latitude, longitude, altitude}
   */
  async updateAssets(userLocation) {
    try {
      console.log("🔄 Updating assets...");
      console.log(
        `📍 User location: ${userLocation.latitude.toFixed(
          6
        )}, ${userLocation.longitude.toFixed(6)}`
      );

      // 使用PostGIS获取附近的素材
      const nearbyAssets = await this.assetService.fetchNearbyAssets(
        userLocation
      );

      console.log(
        `🎯 Found ${nearbyAssets.length} assets within ${this.assetService.MAX_DISTANCE}m`
      );

      // 清除旧的素材
      this.clearAssets();

      // 创建新的素材
      this.assets = nearbyAssets;
      this.createAssetMeshes();
    } catch (error) {
      console.error("❌ Error updating assets:", error);
      throw error;
    }
  }

  /**
   * 创建素材网格
   */
  createAssetMeshes() {
    this.assets.forEach((asset) => {
      // 随机生成位置和朝向
      const position = this.generateRandomPosition();
      const rotation = this.generateRandomRotation();

      let mesh;
      if (asset.file_type === "image") {
        mesh = ImageMeshCreator.create(asset, position, rotation);
      } else if (asset.file_type === "text") {
        mesh = TextMeshCreator.create(asset, position, rotation);
      } else if (asset.file_type === "audio") {
        mesh = AudioMeshCreator.create(asset, position, rotation, this.camera);
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
   * 生成随机位置（在视平线高度，围绕周围）
   * @returns {Object} {x, y, z}
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
   * @returns {number} 旋转角度（弧度）
   */
  generateRandomRotation() {
    // 随机旋转（0-360度）
    return Math.random() * Math.PI * 2;
  }

  /**
   * 更新动画
   * @param {number} delta - 时间增量
   */
  updateAnimations(delta) {
    // 更新所有音频mesh的呼吸动画
    this.assetMeshes.forEach((mesh) => {
      if (mesh.userData.assetType === "audio") {
        AudioMeshCreator.updateBreathingAnimation(mesh, delta);
      }
    });
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
}
