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
   * 从Supabase获取附近的素材（使用PostGIS）
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
