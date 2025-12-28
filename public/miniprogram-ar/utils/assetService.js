// utils/assetService.js
// Supabase配置需要从npm导入，在小程序中使用
// const { createClient } = require('@supabase/supabase-js')

/**
 * 资产服务模块
 * 负责从Supabase获取AR资产
 */
class AssetService {
  constructor() {
    // Supabase 配置
    this.SUPABASE_URL = "https://mkdfezaufjhrfjkfqlbj.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZGZlemF1ZmpocmZqa2ZxbGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDI2NzksImV4cCI6MjA4MDc3ODY3OX0.YvoVQP5k61rl1dbm-y7O-MQCsfke3rnSIzhWvbVGQdU";
    this.DEFAULT_WORKSPACE = "sanlinlaojie";
    this.MAX_DISTANCE = 500; // 最大距离（米）- 增加到500米
  }

  /**
   * 初始化Supabase客户端（需要在使用前调用）
   * 注意：需要先在小程序中安装 @supabase/supabase-js
   */
  initSupabase() {
    if (typeof createClient !== "undefined") {
      this.supabase = createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
    } else {
      console.error(
        "❌ Supabase client not available. Please install @supabase/supabase-js"
      );
    }
  }

  /**
   * 使用wx.request进行Supabase查询
   * @param {string} table - 表名
   * @param {Object} options - 查询选项
   */
  async query(table, options = {}) {
    return new Promise((resolve, reject) => {
      const { select = "*", eq, contains, order, single, limit } = options;

      const params = [`select=${encodeURIComponent(select)}`];

      // 添加等值过滤条件
      if (eq) {
        Object.entries(eq).forEach(([key, value]) => {
          params.push(`${key}=eq.${encodeURIComponent(value)}`);
        });
      }

      // 添加 contains 过滤 (JSON数组包含)
      if (contains) {
        Object.entries(contains).forEach(([key, value]) => {
          // PostgREST uses @> operator for contains
          // For UUID arrays, format: column=cs.{uuid1,uuid2}
          if (Array.isArray(value)) {
            // 如果是UUID数组，直接使用值（不带引号）
            const arrayStr = `{${value.join(",")}}`;
            params.push(`${key}=cs.${arrayStr}`);
            console.log(`🔍 Contains filter: ${key}=cs.${arrayStr}`);
          } else {
            params.push(`${key}=cs.{${value}}`);
          }
        });
      }

      // 添加排序
      if (order) {
        params.push(
          `order=${order.column}.${order.ascending ? "asc" : "desc"}`
        );
      }

      // 添加限制
      if (limit) {
        params.push(`limit=${limit}`);
      }

      const url = `${this.SUPABASE_URL}/rest/v1/${table}?${params.join("&")}`;

      console.log(`📡 Querying table: ${table}`, url);

      wx.request({
        url: url,
        method: "GET",
        header: {
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Accept: single
            ? "application/vnd.pgrst.object+json"
            : "application/json",
        },
        success: (res) => {
          console.log(`📡 Query Response [${res.statusCode}]:`, res.data);

          if (res.statusCode === 200 || res.statusCode === 206) {
            resolve(res.data);
          } else {
            console.error(`📡 Query Error Details:`, res);
            const error = new Error(`Query error: ${res.statusCode}`);
            error.response = res;
            reject(error);
          }
        },
        fail: (err) => {
          console.error(`📡 Query Failed:`, err);
          reject(err);
        },
      });
    });
  }

  /**
   * 使用wx.request进行RPC调用
   */
  async rpc(functionName, params = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.SUPABASE_URL}/rest/v1/rpc/${functionName}`;

      console.log(`📡 Calling RPC: ${functionName}`, params);

      wx.request({
        url: url,
        method: "POST",
        header: {
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: params,
        success: (res) => {
          console.log(`📡 RPC Response [${res.statusCode}]:`, res.data);

          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            const error = new Error(`RPC error: ${res.statusCode}`);
            error.response = res;
            reject(error);
          }
        },
        fail: (err) => {
          console.error(`📡 RPC Failed:`, err);
          reject(err);
        },
      });
    });
  }

  /**
   * 获取用户位置
   * @param {boolean} useCache - 是否允许使用缓存位置
   * @returns {Promise<{latitude: number, longitude: number, altitude: number}>}
   */
  async getUserLocation(useCache = true) {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: "gcj02", // 国测局坐标系
        altitude: true,
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            altitude: res.altitude || 0,
          });
        },
        fail: (err) => {
          console.error("❌ Failed to get location:", err);
          reject(err);
        },
      });
    });
  }

  /**
   * 获取所有Anchor列表
   * @returns {Promise<Array>} Anchor列表
   */
  async fetchAnchors() {
    try {
      console.log("🔍 Fetching anchors...");

      // 1. 先获取workspace ID
      const workspace = await this.query("workspace", {
        select: "id",
        eq: { name: this.DEFAULT_WORKSPACE },
        single: true,
      });

      if (!workspace || !workspace.id) {
        console.warn("⚠️ Workspace not found");
        return [];
      }

      console.log(`📍 Found workspace: ${workspace.id}`);

      // 2. 查询所有 anchor 类型的资产
      try {
        // 首先尝试使用 contains 操作符
        const anchors = await this.query("asset", {
          select: "id,name,text_content,metadata",
          contains: { workspace_id: [workspace.id] },
          eq: { file_type: "anchor" },
          order: { column: "create_at", ascending: false },
        });

        console.log(`📍 Fetched ${anchors?.length || 0} anchors`);
        return anchors || [];
      } catch (containsError) {
        console.warn(
          "⚠️ Contains query failed, trying without workspace filter:",
          containsError.message
        );

        // 降级：获取所有 anchor 类型的资产，然后在客户端过滤
        const allAnchors = await this.query("asset", {
          select: "id,name,text_content,metadata,workspace_id",
          eq: { file_type: "anchor" },
          order: { column: "create_at", ascending: false },
        });

        // 客户端过滤
        const filtered = allAnchors.filter(
          (anchor) =>
            anchor.workspace_id &&
            Array.isArray(anchor.workspace_id) &&
            anchor.workspace_id.includes(workspace.id)
        );

        console.log(
          `📍 Fetched ${filtered?.length || 0} anchors (client-side filtered)`
        );
        return filtered || [];
      }
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
   * @param {string} options.anchorId - (可选) Anchor ID
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
   * 按地理位置获取附近的素材
   * @param {Object} userLocation - 用户位置 {latitude, longitude}
   * @returns {Promise<Array>} 附近的资产列表
   */
  async fetchNearbyAssets(userLocation) {
    try {
      if (!userLocation) {
        console.warn("⚠️ No user location available");
        return [];
      }

      console.log("🔍 Fetching nearby assets...");

      // 先尝试使用RPC调用PostGIS函数（如果存在）
      try {
        const response = await this.rpc("get_nearby_assets", {
          user_lat: userLocation.latitude,
          user_lng: userLocation.longitude,
          max_distance_meters: this.MAX_DISTANCE,
          workspace_name: this.DEFAULT_WORKSPACE,
        });

        console.log(`📦 RPC returned ${response?.length || 0} nearby assets`);

        // 如果RPC返回空数组，尝试fallback
        if (!response || response.length === 0) {
          console.warn("⚠️ RPC returned empty, trying fallback...");
          return await this.fetchNearbyAssetsFallback(userLocation);
        }

        // 打印距离信息
        response.forEach((asset) => {
          console.log(
            `✅ Asset ${asset.id} (${asset.file_type}) is ${
              asset.distance?.toFixed(0) || "?"
            }m away`
          );
        });

        return response;
      } catch (rpcError) {
        console.warn("⚠️ RPC failed, using fallback query:", rpcError.message);
        return await this.fetchNearbyAssetsFallback(userLocation);
      }
    } catch (error) {
      console.error("❌ Error fetching nearby assets:", error);
      return [];
    }
  }

  /**
   * 降级方案：直接查询并在客户端过滤
   * @param {Object} userLocation - 用户位置
   * @returns {Promise<Array>} 附近的资产列表
   */
  async fetchNearbyAssetsFallback(userLocation) {
    try {
      console.log("🔄 Using fallback method (client-side filtering)...");

      // 1. 获取workspace ID
      const workspace = await this.query("workspace", {
        select: "id",
        eq: { name: this.DEFAULT_WORKSPACE },
        single: true,
      });

      if (!workspace || !workspace.id) {
        console.warn("⚠️ Workspace not found");
        return [];
      }

      console.log(`📍 Workspace ID: ${workspace.id}`);

      // 2. 获取所有资产（不过滤workspace，先看看有没有数据）
      console.log("📦 Fetching all assets...");
      const allAssets = await this.query("asset", {
        select: "id,file_type,file_url,text_content,metadata,workspace_id",
      });

      console.log(`📦 Total assets in database: ${allAssets?.length || 0}`);

      if (!allAssets || allAssets.length === 0) {
        console.log("📦 No assets found in database");
        return [];
      }

      // 3. 过滤workspace
      const workspaceAssets = allAssets.filter(
        (asset) =>
          asset.workspace_id &&
          Array.isArray(asset.workspace_id) &&
          asset.workspace_id.includes(workspace.id)
      );

      console.log(`📦 Assets in workspace: ${workspaceAssets.length}`);

      // 4. 客户端过滤：计算距离并过滤
      const assetsWithDistance = workspaceAssets
        .map((asset) => {
          // 打印每个asset的metadata
          console.log(`🔍 Asset ${asset.id}:`, {
            file_type: asset.file_type,
            has_metadata: !!asset.metadata,
            metadata: asset.metadata,
          });

          if (!asset.metadata?.latitude || !asset.metadata?.longitude) {
            console.log(`  ⚠️ Missing location data`);
            return null;
          }

          const distance = this.calculateDistance(userLocation, {
            latitude: asset.metadata.latitude,
            longitude: asset.metadata.longitude,
          });

          console.log(`  📍 Distance: ${distance.toFixed(0)}m`);

          return { ...asset, distance };
        })
        .filter((asset) => asset !== null);

      console.log(
        `📦 Total assets with location: ${assetsWithDistance.length}`
      );
      console.log(`🎯 Max distance filter: ${this.MAX_DISTANCE}m`);

      // 显示所有资产的距离
      assetsWithDistance.forEach((asset) => {
        const inRange = asset.distance <= this.MAX_DISTANCE;
        console.log(
          `${inRange ? "✅" : "❌"} Asset ${asset.id} (${
            asset.file_type
          }) is ${asset.distance.toFixed(0)}m away ${
            inRange ? "[IN RANGE]" : "[OUT OF RANGE]"
          }`
        );
      });

      const nearbyAssets = assetsWithDistance
        .filter((asset) => asset.distance <= this.MAX_DISTANCE)
        .sort((a, b) => a.distance - b.distance);

      console.log(
        `📦 Fetched ${nearbyAssets.length} nearby assets (client-side filter)`
      );

      nearbyAssets.forEach((asset) => {
        console.log(
          `✅ Asset ${asset.id} (${
            asset.file_type
          }) is ${asset.distance.toFixed(0)}m away`
        );
      });

      return nearbyAssets;
    } catch (error) {
      console.error("❌ Error in fallback query:", error);
      return [];
    }
  }

  /**
   * 按Anchor获取素材
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

      // 1. 获取workspace ID
      const workspace = await this.query("workspace", {
        select: "id",
        eq: { name: this.DEFAULT_WORKSPACE },
        single: true,
      });

      if (!workspace || !workspace.id) {
        console.warn("⚠️ Workspace not found");
        return [];
      }

      // 2. 按 anchor_id 查询素材
      const assets = await this.query("asset", {
        select: "id,file_type,file_url,text_content,metadata",
        contains: { workspace_id: [workspace.id] },
        eq: { anchor_id: anchorId },
      });

      console.log(`📦 Fetched ${assets?.length || 0} assets for anchor`);
      return assets || [];
    } catch (error) {
      console.error("❌ Error fetching assets by anchor:", error);
      return [];
    }
  }

  /**
   * 按最近的Anchor获取素材
   * @param {Object} userLocation - 用户位置
   * @returns {Promise<Array>} 素材列表
   */
  async fetchAssetsByNearestAnchor(userLocation) {
    try {
      if (!userLocation) {
        console.warn("⚠️ No user location available");
        return [];
      }

      console.log("🔍 Fetching assets by nearest anchor...");

      // 1. 获取所有 anchors
      const anchors = await this.fetchAnchors();

      if (!anchors || anchors.length === 0) {
        console.warn("⚠️ No anchors found");
        return [];
      }

      // 2. 找到最近的 anchor
      let nearestAnchor = null;
      let minDistance = Infinity;

      anchors.forEach((anchor) => {
        if (anchor.metadata?.latitude && anchor.metadata?.longitude) {
          const distance = this.calculateDistance(userLocation, {
            latitude: anchor.metadata.latitude,
            longitude: anchor.metadata.longitude,
          });

          if (distance < minDistance) {
            minDistance = distance;
            nearestAnchor = anchor;
          }
        }
      });

      if (!nearestAnchor || minDistance > this.MAX_DISTANCE) {
        console.warn(`⚠️ No anchor within ${this.MAX_DISTANCE}m`);
        return [];
      }

      console.log(
        `🎯 Found nearest anchor: ${
          nearestAnchor.name
        } at ${minDistance.toFixed(0)}m`
      );

      // 3. 获取该 anchor 的素材
      return await this.fetchAssetsByAnchor(nearestAnchor.id);
    } catch (error) {
      console.error("❌ Error fetching assets by nearest anchor:", error);
      return [];
    }
  }

  /**
   * 计算两点之间的距离（Haversine公式）
   * @param {Object} point1 - {latitude, longitude}
   * @param {Object} point2 - {latitude, longitude}
   * @returns {number} 距离（米）
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // 地球半径（米）
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }
}

module.exports = AssetService;
