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
   * 从Supabase获取附近的素材（使用PostGIS）
   */
  async fetchNearbyAssets() {
    try {
      if (!this.userLocation) {
        console.warn("⚠️ No user location available");
        return [];
      }

      console.log("🔍 Fetching nearby assets using PostGIS...");

      // 使用 RPC 调用 PostGIS 函数进行地理位置过滤
      const { data, error } = await this.supabase.rpc("get_nearby_assets", {
        user_lat: this.userLocation.latitude,
        user_lng: this.userLocation.longitude,
        max_distance_meters: this.MAX_DISTANCE,
        workspace_name: this.DEFAULT_WORKSPACE,
      });

      if (error) {
        console.error("❌ PostGIS RPC error:", error);
        // 如果 RPC 失败，降级到客户端过滤
        return await this.fetchNearbyAssetsFallback();
      }

      console.log(`📦 Fetched ${data?.length || 0} nearby assets from PostGIS`);

      // 添加距离信息到日志
      if (data && data.length > 0) {
        data.forEach((asset) => {
          console.log(
            `✅ Asset ${asset.id} (${asset.file_type}) is ${
              asset.distance?.toFixed(0) || "?"
            }m away`,
            asset.file_type === "text"
              ? `text: "${asset.text_content}"`
              : `url: ${asset.file_url}`
          );
        });
      }

      console.log("📋 Full asset data:", JSON.stringify(data, null, 2));

      return data || [];
    } catch (error) {
      console.error("❌ Error fetching assets:", error);
      return [];
    }
  }

  /**
   * 降级方案：客户端过滤（当PostGIS RPC不可用时）
   */
  async fetchNearbyAssetsFallback() {
    try {
      console.log("🔄 Using fallback method (client-side filtering)...");

      // 获取workspace ID
      const { data: workspaces, error: wsError } = await this.supabase
        .from("workspace")
        .select("id")
        .eq("name", this.DEFAULT_WORKSPACE)
        .single();

      if (wsError) throw wsError;
      if (!workspaces) return [];

      // 获取所有资产
      const { data: allAssets, error } = await this.supabase
        .from("asset")
        .select("id, file_type, file_url, text_content, metadata")
        .contains("workspace_id", [workspaces.id])
        .not("location", "is", null);

      if (error) throw error;

      // 客户端过滤距离
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

        return distance <= this.MAX_DISTANCE;
      });

      console.log(`📦 Fallback found ${nearbyAssets.length} nearby assets`);
      return nearbyAssets;
    } catch (error) {
      console.error("❌ Fallback method error:", error);
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

      // 使用PostGIS获取附近的素材
      const nearbyAssets = await this.fetchNearbyAssets();

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
    console.log(`🏗️ Creating meshes for ${this.assets.length} assets`);

    this.assets.forEach((asset, index) => {
      console.log(
        `🔨 Processing asset ${index + 1}/${this.assets.length}: ${asset.id} (${
          asset.file_type
        })`
      );

      // 初始角度分布
      const angle = (index / this.assets.length) * Math.PI * 2;

      let mesh;
      if (asset.file_type === "image") {
        console.log(`🖼️ Creating image mesh for ${asset.id}`);
        mesh = this.createImageMesh(asset, angle);
      } else if (asset.file_type === "text") {
        console.log(
          `📝 Creating text mesh for ${asset.id}: "${asset.text_content}"`
        );
        mesh = this.createTextMesh(asset, angle);
      } else {
        console.warn(`⚠️ Unknown asset type: ${asset.file_type}`);
        return;
      }

      if (mesh) {
        this.group.add(mesh);
        this.assetMeshes.push(mesh);
        console.log(`✅ Added mesh to group for asset ${asset.id}`);
      } else {
        console.error(`❌ Failed to create mesh for asset ${asset.id}`);
      }
    });

    console.log(`✨ Created ${this.assetMeshes.length} asset meshes`);
  }

  /**
   * 创建图片mesh
   */
  createImageMesh(asset, angle) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.angle = angle;
    mesh.userData.assetId = asset.id;
    mesh.userData.assetType = "image";

    // 加载纹理
    textureLoader.load(
      asset.file_url,
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;

        // 根据图片比例调整平面大小，保持原始比例
        const aspect = texture.image.width / texture.image.height;
        const baseSize = 0.7;

        if (aspect > 1) {
          mesh.scale.set(aspect * baseSize, baseSize, 1);
        } else {
          mesh.scale.set(baseSize, baseSize / aspect, 1);
        }

        console.log(
          `✅ Loaded image for asset ${asset.id}, aspect: ${aspect.toFixed(2)}`
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

    return mesh;
  }

  /**
   * 创建文字mesh（圆角方块）
   */
  createTextMesh(asset, angle) {
    // 创建圆角方块
    const geometry = new THREE.BoxGeometry(0.8, 0.6, 0.1, 8, 8, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.angle = angle;
    mesh.userData.assetId = asset.id;
    mesh.userData.assetType = "text";

    // 创建canvas来绘制文字
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 384;

    // 背景（圆角矩形）
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制文字
    context.fillStyle = "#000000";
    context.font = "bold 32px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    // 自动换行
    const text = asset.text_content || "(无内容)";
    const maxWidth = canvas.width - 40;
    const lineHeight = 40;
    const words = text.split("");
    let line = "";
    let y = canvas.height / 2 - 20;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = context.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        context.fillText(line, canvas.width / 2, y);
        line = words[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, canvas.width / 2, y);

    // 将canvas作为纹理应用到材质
    const texture = new THREE.CanvasTexture(canvas);
    material.map = texture;
    material.needsUpdate = true;

    console.log(`✅ Created text mesh for asset ${asset.id}`);

    return mesh;
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
