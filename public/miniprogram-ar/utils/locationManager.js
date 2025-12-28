// utils/locationManager.js

/**
 * 位置管理器
 * 负责追踪用户位置变化并触发更新
 */
class LocationManager {
  constructor() {
    this.currentLocation = null; // 当前位置
    this.lastUpdateLocation = null; // 上次更新时的位置
    this.locationWatchInterval = null; // 定时器ID
    this.UPDATE_DISTANCE_THRESHOLD = 10; // 移动10米才更新（米）
    this.WATCH_INTERVAL = 3000; // 每3秒检查一次位置
    this.onLocationChangeCallback = null;
  }

  /**
   * 设置位置变化的回调函数
   * @param {Function} callback - 当位置变化超过阈值时的回调
   */
  onLocationChange(callback) {
    this.onLocationChangeCallback = callback;
  }

  /**
   * 获取用户当前位置
   * @param {boolean} useCache - 是否允许使用缓存
   * @returns {Promise<Object>} 位置信息
   */
  async getUserLocation(useCache = true) {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: "gcj02", // 国测局坐标系
        altitude: true,
        isHighAccuracy: true,
        success: (res) => {
          const location = {
            latitude: res.latitude,
            longitude: res.longitude,
            altitude: res.altitude || 0,
            accuracy: res.accuracy || 0,
            timestamp: Date.now(),
          };

          // 更新当前位置
          this.currentLocation = location;

          console.log(
            `📍 Location updated: ${location.latitude.toFixed(
              6
            )}, ${location.longitude.toFixed(
              6
            )} (accuracy: ${location.accuracy.toFixed(0)}m)`
          );

          resolve(location);
        },
        fail: (err) => {
          console.error("❌ Failed to get location:", err);

          // 如果有缓存且允许使用，返回缓存
          if (useCache && this.currentLocation) {
            console.log("⚠️ Using cached location");
            resolve(this.currentLocation);
          } else {
            reject(err);
          }
        },
      });
    });
  }

  /**
   * 启动位置持续监听
   */
  startTracking() {
    console.log("🚀 Starting location tracking...");

    // 先获取一次位置
    this.getUserLocation(false).catch((err) => {
      console.error("❌ Initial location fetch failed:", err);
    });

    // 定时获取位置（微信小程序不支持watchPosition，使用定时器模拟）
    this.locationWatchInterval = setInterval(() => {
      this.getUserLocation(true).catch((err) => {
        console.error("❌ Location update failed:", err);
      });
    }, this.WATCH_INTERVAL);
  }

  /**
   * 停止位置追踪
   */
  stopTracking() {
    console.log("🛑 Stopping location tracking...");

    if (this.locationWatchInterval !== null) {
      clearInterval(this.locationWatchInterval);
      this.locationWatchInterval = null;
    }
  }

  /**
   * 启动定期检查（每2秒检查一次位置是否变化超过阈值）
   */
  startPeriodicCheck() {
    setInterval(() => {
      this.checkLocationChange();
    }, 2000);
  }

  /**
   * 检查位置变化并决定是否触发回调
   */
  async checkLocationChange() {
    try {
      // 如果当前没有位置，跳过
      if (!this.currentLocation) {
        console.log("⏳ Waiting for location...");
        return;
      }

      // 如果是第一次或没有上次位置记录，标记当前位置为上次位置
      if (!this.lastUpdateLocation) {
        this.lastUpdateLocation = this.currentLocation;
        return;
      }

      // 计算距离上次更新位置的距离
      const distance = this.calculateDistance(
        this.lastUpdateLocation,
        this.currentLocation
      );

      console.log(`📏 Distance moved: ${distance.toFixed(2)}m`);

      // 如果移动距离超过阈值，触发回调
      if (distance >= this.UPDATE_DISTANCE_THRESHOLD) {
        console.log(
          "🔔 Location changed significantly, triggering callback..."
        );

        // 更新上次位置
        this.lastUpdateLocation = this.currentLocation;

        // 触发回调
        if (this.onLocationChangeCallback) {
          await this.onLocationChangeCallback();
        }
      }
    } catch (error) {
      console.error("❌ Error checking location change:", error);
    }
  }

  /**
   * 标记位置已更新（在手动更新素材后调用）
   */
  markLocationUpdated() {
    if (this.currentLocation) {
      this.lastUpdateLocation = { ...this.currentLocation };
      console.log("✅ Location marked as updated");
    }
  }

  /**
   * 计算两点之间的距离（Haversine公式）
   * @param {Object} point1 - {latitude, longitude}
   * @param {Object} point2 - {latitude, longitude}
   * @returns {number} 距离（米）
   */
  calculateDistance(point1, point2) {
    if (!point1 || !point2) {
      return 0;
    }

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

  /**
   * 获取当前位置（同步）
   * @returns {Object|null} 当前位置或null
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * 清除位置信息
   */
  clearLocation() {
    this.currentLocation = null;
    this.lastUpdateLocation = null;
    console.log("🗑️ Location cleared");
  }
}

module.exports = LocationManager;
