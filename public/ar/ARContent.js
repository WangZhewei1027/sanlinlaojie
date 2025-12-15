/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * AR内容组件
 * 创建和管理AR场景中的3D内容
 */
class ARContent {
  constructor() {
    this.group = new THREE.Group();
    this.userLocation = null;
    this.assets = [];
    this.assetMeshes = [];
    this.rotationSpeed = 0.005; // 旋转速度
    this.radius = 1.2; // 旋转半径（米）

    // Supabase 配置
    this.SUPABASE_URL = "https://mkdfezaufjhrfjkfqlbj.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZGZlemF1ZmpocmZqa2ZxbGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDI2NzksImV4cCI6MjA4MDc3ODY3OX0.YvoVQP5k61rl1dbm-y7O-MQCsfke3rnSIzhWvbVGQdU";
    this.DEFAULT_WORKSPACE = "sanlinlaojie";
    this.MAX_DISTANCE = 50; // 最大距离（米）

    // 初始化 Supabase
    this.supabase = window.supabase.createClient(
      this.SUPABASE_URL,
      this.SUPABASE_KEY
    );

    this.init();
    this.startAssetUpdates();
  }

  /**
   * 初始化3D内容
   */
  init() {
    // 创建一个简单的彩色方块
    const cubeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const cubeMaterial = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    this.cube.position.set(0, 1.0, 0); // 设置在anchor上方1米，悬浮在空中

    this.group.add(this.cube);
  }

  /**
   * 更新动画
   */
  update() {
    // 让方块转动，方便观察定位
    if (this.cube) {
      this.cube.rotation.y += 0.01;
    }

    // 更新素材围绕cube旋转
    this.updateAssetRotation();
  }

  /**
   * 开始定时更新素材
   */
  startAssetUpdates() {
    // 立即获取一次
    this.updateAssets();

    // 每15秒更新一次
    setInterval(() => {
      this.updateAssets();
    }, 15000);
  }

  /**
   * 获取用户位置
   */
  async getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || 0,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * 从Supabase获取附近的素材
   */
  async fetchNearbyAssets() {
    try {
      console.log("🔍 Fetching workspace...");

      // 获取workspace ID
      const { data: workspaces, error: wsError } = await this.supabase
        .from("workspace")
        .select("id")
        .eq("name", this.DEFAULT_WORKSPACE)
        .single();

      if (wsError) throw wsError;
      if (!workspaces) return [];

      console.log(`✅ Workspace found: ${workspaces.id}`);

      // 获取资产
      const { data, error } = await this.supabase
        .from("asset")
        .select("id, file_type, file_url, metadata")
        .contains("workspace_id", [workspaces.id])
        .not("location", "is", null)
        .eq("file_type", "image");

      if (error) throw error;

      console.log(`📦 Fetched ${data?.length || 0} assets from Supabase`);
      return data || [];
    } catch (error) {
      console.error("❌ Error fetching assets:", error);
      return [];
    }
  }

  /**
   * 计算GPS距离（米）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const latDiff = lat2 - lat1;
    const lonDiff = lon2 - lon1;

    const latToMeters = 111000;
    const lonToMeters = 111000 * Math.cos((lat1 * Math.PI) / 180);

    const x = lonDiff * lonToMeters;
    const z = latDiff * latToMeters;

    return Math.sqrt(x * x + z * z);
  }

  /**
   * 更新素材
   */
  async updateAssets() {
    try {
      console.log("🔄 Updating assets...");

      // 获取用户位置
      this.userLocation = await this.getUserLocation();
      console.log(
        `📍 User location: ${this.userLocation.latitude.toFixed(
          6
        )}, ${this.userLocation.longitude.toFixed(6)}`
      );

      // 获取所有素材
      const allAssets = await this.fetchNearbyAssets();

      // 过滤距离在50m内的素材
      const nearbyAssets = allAssets.filter((asset) => {
        if (!asset.metadata?.latitude || !asset.metadata?.longitude) {
          return false;
        }

        const distance = this.calculateDistance(
          this.userLocation.latitude,
          this.userLocation.longitude,
          asset.metadata.latitude,
          asset.metadata.longitude
        );

        if (distance <= this.MAX_DISTANCE) {
          console.log(`✅ Asset ${asset.id} is ${distance.toFixed(0)}m away`);
          return true;
        }

        return false;
      });

      console.log(
        `🎯 Found ${nearbyAssets.length} assets within ${this.MAX_DISTANCE}m`
      );

      // 清除旧的素材
      this.clearAssets();

      // 创建新的素材
      this.assets = nearbyAssets;
      this.createAssetMeshes();
    } catch (error) {
      console.error("❌ Error updating assets:", error);
    }
  }

  /**
   * 创建素材网格
   */
  createAssetMeshes() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";

    this.assets.forEach((asset, index) => {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // 初始角度分布
      const angle = (index / this.assets.length) * Math.PI * 2;
      mesh.userData.angle = angle;
      mesh.userData.assetId = asset.id;

      // 加载纹理
      textureLoader.load(
        asset.file_url,
        (texture) => {
          material.map = texture;
          material.needsUpdate = true;

          // 根据图片比例调整平面大小，保持原始比例
          const aspect = texture.image.width / texture.image.height;
          const baseSize = 0.7; // 基础尺寸

          if (aspect > 1) {
            // 横向图片
            mesh.scale.set(aspect * baseSize, baseSize, 1);
          } else {
            // 纵向图片
            mesh.scale.set(baseSize, baseSize / aspect, 1);
          }

          console.log(
            `✅ Loaded texture for asset ${asset.id}, aspect: ${aspect.toFixed(
              2
            )}`
          );
        },
        undefined,
        (error) => {
          console.error(
            `❌ Failed to load texture for asset ${asset.id}:`,
            error
          );
          material.color.setHex(0xff0000);
        }
      );

      this.group.add(mesh);
      this.assetMeshes.push(mesh);
    });

    console.log(`✨ Created ${this.assetMeshes.length} asset meshes`);
  }

  /**
   * 更新素材旋转动画
   */
  updateAssetRotation() {
    this.assetMeshes.forEach((mesh) => {
      // 更新角度
      mesh.userData.angle += this.rotationSpeed;

      // 计算位置（围绕cube旋转）
      const x = Math.cos(mesh.userData.angle) * this.radius;
      const z = Math.sin(mesh.userData.angle) * this.radius;
      const y = 1.0; // 与cube同高

      mesh.position.set(x, y, z);

      // 让图片面向中心（cube）
      mesh.lookAt(0, 1.0, 0);
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
