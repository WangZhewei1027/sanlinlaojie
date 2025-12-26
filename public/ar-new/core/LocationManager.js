/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 位置管理器
 * 负责追踪用户位置变化并触发更新
 */
class LocationManager {
  constructor() {
    this.currentLocation = null; // 当前位置（实时更新）
    this.lastUpdateLocation = null; // 上次更新时的位置
    this.locationWatchId = null;
    this.UPDATE_DISTANCE_THRESHOLD = 10; // 移动10米才更新（米）
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
   * 启动位置持续监听
   */
  startTracking() {
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
   * 停止位置追踪
   */
  stopTracking() {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
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

      // 如果移动距离超过阈值，触发回调
      if (distance >= this.UPDATE_DISTANCE_THRESHOLD) {
        console.log(`🚶 Moved ${distance.toFixed(2)}m, triggering update...`);
        if (this.onLocationChangeCallback) {
          await this.onLocationChangeCallback();
          // 更新后保存当前位置作为上次更新位置
          this.lastUpdateLocation = { ...this.currentLocation };
        }
      }
    } catch (error) {
      console.error("❌ Error checking location:", error);
    }
  }

  /**
   * 计算两个GPS坐标之间的距离（米）
   * 使用Haversine公式
   * @param {Object} loc1 - 位置1 {latitude, longitude}
   * @param {Object} loc2 - 位置2 {latitude, longitude}
   * @returns {number} 距离（米）
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
   * 获取当前位置
   * @returns {Object|null} 当前位置或null
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * 标记位置已更新
   */
  markLocationUpdated() {
    this.lastUpdateLocation = { ...this.currentLocation };
  }
}
