/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 资产服务模块
 * 负责从Supabase获取附近的AR资产
 */
class AssetService {
  constructor() {
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
  }

  /**
   * 获取用户位置
   * @param {boolean} useCache - 是否允许使用缓存位置（默认允许）
   * @returns {Promise<{latitude: number, longitude: number, altitude: number}>}
   */
  async getUserLocation(useCache = true) {
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
          timeout: 15000, // 增加超时时间到15秒
          maximumAge: useCache ? 5000 : 0, // 允许5秒的缓存
        }
      );
    });
  }

  /**
   * 获取所有 Anchor 列表
   * @returns {Promise<Array>} Anchor 列表
   */
  async fetchAnchors() {
    try {
      console.log("🔍 Fetching anchors...");

      // 获取workspace ID
      const { data: workspaces, error: wsError } = await this.supabase
        .from("workspace")
        .select("id")
        .eq("name", this.DEFAULT_WORKSPACE)
        .single();

      if (wsError) throw wsError;
      if (!workspaces) return [];

      // 查询所有 anchor 类型的资产
      const { data: anchors, error } = await this.supabase
        .from("asset")
        .select("id, name, text_content, metadata")
        .contains("workspace_id", [workspaces.id])
        .eq("file_type", "anchor")
        .order("create_at", { ascending: false });

      if (error) throw error;

      console.log(`📍 Fetched ${anchors?.length || 0} anchors`);

      return anchors || [];
    } catch (error) {
      console.error("❌ Error fetching anchors:", error);
      return [];
    }
  }

  /**
   * 统一的素材获取入口
   * @param {Object} options - 获取选项
   * @param {string} options.mode - 获取模式: 'nearby' | 'anchor' | 'nearestAnchor'
   * @param {Object} options.userLocation - 用户位置 {latitude, longitude}
   * @param {string} options.anchorId - (可选) Anchor ID，用于 anchor 模式
   * @returns {Promise<Array>} 素材列表
   */
  async fetchAssets(options) {
    const { mode = "nearby", userLocation, anchorId } = options;

    try {
      console.log(`🔍 Fetching assets in ${mode} mode...`);

      switch (mode) {
        case "nearby":
          return await this.fetchNearbyAssets(userLocation);
        case "anchor":
          return await this.fetchAssetsByAnchor(anchorId);
        case "nearestAnchor":
          return await this.fetchAssetsByNearestAnchor(userLocation);
        default:
          console.error(`❌ Unknown fetch mode: ${mode}`);
          return [];
      }
    } catch (error) {
      console.error("❌ Error in fetchAssets:", error);
      return [];
    }
  }

  /**
   * 按地理位置获取附近的素材（使用PostGIS）
   * @param {Object} userLocation - 用户位置 {latitude, longitude}
   * @returns {Promise<Array>} 附近的资产列表
   */
  async fetchNearbyAssets(userLocation) {
    try {
      if (!userLocation) {
        console.warn("⚠️ No user location available");
        return [];
      }

      console.log("🔍 Fetching nearby assets using PostGIS...");

      // 使用 RPC 调用 PostGIS 函数进行地理位置过滤
      const { data, error } = await this.supabase.rpc("get_nearby_assets", {
        user_lat: userLocation.latitude,
        user_lng: userLocation.longitude,
        max_distance_meters: this.MAX_DISTANCE,
        workspace_name: this.DEFAULT_WORKSPACE,
      });

      if (error) {
        console.error("❌ PostGIS RPC error:", error);
        // 如果 RPC 失败，降级到客户端过滤
        return await this.fetchNearbyAssetsFallback(userLocation);
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

      return data || [];
    } catch (error) {
      console.error("❌ Error fetching assets:", error);
      return [];
    }
  }

  /**
   * 按 Anchor 获取素材
   * @param {string} anchorId - Anchor ID
   * @returns {Promise<Array>} 素材列表
   */
  async fetchAssetsByAnchor(anchorId) {
    try {
      if (!anchorId) {
        console.warn("⚠️ No anchor ID provided");
        return [];
      }

      console.log(`🔍 Fetching assets for anchor: ${anchorId}`);

      // 获取workspace ID
      const { data: workspaces, error: wsError } = await this.supabase
        .from("workspace")
        .select("id")
        .eq("name", this.DEFAULT_WORKSPACE)
        .single();

      if (wsError) throw wsError;
      if (!workspaces) return [];

      // 按 anchor_id 查询素材
      const { data: assets, error } = await this.supabase
        .from("asset")
        .select("id, file_type, file_url, text_content, metadata")
        .contains("workspace_id", [workspaces.id])
        .eq("anchor_id", anchorId);

      if (error) throw error;

      console.log(
        `📦 Fetched ${assets?.length || 0} assets for anchor ${anchorId}`
      );

      if (assets && assets.length > 0) {
        assets.forEach((asset) => {
          console.log(
            `✅ Asset ${asset.id} (${asset.file_type})`,
            asset.file_type === "text"
              ? `text: "${asset.text_content}"`
              : `url: ${asset.file_url}`
          );
        });
      }

      return assets || [];
    } catch (error) {
      console.error("❌ Error fetching assets by anchor:", error);
      return [];
    }
  }

  /**
   * 获取最近的 Anchor 并返回其关联的素材
   * @param {Object} userLocation - 用户位置 {latitude, longitude}
   * @returns {Promise<Array>} 素材列表
   */
  async fetchAssetsByNearestAnchor(userLocation) {
    try {
      if (!userLocation) {
        console.warn("⚠️ No user location available");
        return [];
      }

      console.log("🔍 Finding nearest anchor...");

      // 获取workspace ID
      const { data: workspaces, error: wsError } = await this.supabase
        .from("workspace")
        .select("id")
        .eq("name", this.DEFAULT_WORKSPACE)
        .single();

      if (wsError) throw wsError;
      if (!workspaces) return [];

      // 获取所有 anchor
      const { data: anchors, error: anchorError } = await this.supabase
        .from("asset")
        .select("id, name, metadata")
        .contains("workspace_id", [workspaces.id])
        .eq("file_type", "anchor")
        .not("metadata", "is", null);

      if (anchorError) throw anchorError;
      if (!anchors || anchors.length === 0) {
        console.warn("⚠️ No anchors found");
        return [];
      }

      // 找到最近的 anchor
      let nearestAnchor = null;
      let minDistance = Infinity;

      anchors.forEach((anchor) => {
        if (anchor.metadata?.latitude && anchor.metadata?.longitude) {
          const distance = this.calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            anchor.metadata.latitude,
            anchor.metadata.longitude
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestAnchor = anchor;
          }
        }
      });

      if (!nearestAnchor) {
        console.warn("⚠️ No valid anchor with location found");
        return [];
      }

      console.log(
        `📍 Nearest anchor: ${
          nearestAnchor.name || nearestAnchor.id
        } (${minDistance.toFixed(0)}m away)`
      );

      // 获取该 anchor 关联的所有素材
      const assets = await this.fetchAssetsByAnchor(nearestAnchor.id);

      return assets;
    } catch (error) {
      console.error("❌ Error fetching assets by nearest anchor:", error);
      return [];
    }
  }

  /**
   * 降级方案：客户端过滤（当PostGIS RPC不可用时）
   * @param {Object} userLocation - 用户位置 {latitude, longitude}
   * @returns {Promise<Array>} 附近的资产列表
   */
  async fetchNearbyAssetsFallback(userLocation) {
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
          userLocation.latitude,
          userLocation.longitude,
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
   * @param {number} lat1 - 第一个点的纬度
   * @param {number} lon1 - 第一个点的经度
   * @param {number} lat2 - 第二个点的纬度
   * @param {number} lon2 - 第二个点的经度
   * @returns {number} 距离（米）
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
}
