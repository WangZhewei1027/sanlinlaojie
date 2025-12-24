/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 设备方向检测器
 * 检测手机是否保持竖直，并在稳定后自动放置
 */
class DeviceOrientationChecker {
  constructor(statusIndicator) {
    this.statusIndicator = statusIndicator;
    this.hasPlaced = false;
    this.orientationStableStartTime = null;
    this.STABLE_DURATION = 2000; // 需要稳定2秒
    this.VERTICAL_THRESHOLD = 20; // 竖直方向阈值（度数）
    this.onPlacedCallback = null;
  }

  /**
   * 设置放置完成的回调函数
   */
  onPlaced(callback) {
    this.onPlacedCallback = callback;
  }

  /**
   * 开始检测设备方向
   */
  start() {
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", (event) => {
        this.handleOrientation(event);
      });
    } else {
      console.warn("⚠️ 设备不支持方向检测，3秒后自动放置");
      this.statusIndicator.textContent = "自动放置中...";
      setTimeout(() => {
        this.completePlacement();
      }, 3000);
    }
  }

  /**
   * 处理设备方向事件
   */
  handleOrientation(event) {
    if (this.hasPlaced) return;

    // beta: 设备绕X轴旋转（前后倾斜）
    // -90到90度，0度表示设备水平
    // 接近90度表示手机竖直向上，接近-90度表示竖直向下
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;

    // 检查是否接近竖直（允许前后倾斜一定角度）
    const isVertical =
      Math.abs(beta - 90) < this.VERTICAL_THRESHOLD &&
      Math.abs(gamma) < this.VERTICAL_THRESHOLD;

    if (isVertical) {
      this.handleVerticalOrientation();
    } else {
      this.handleNonVerticalOrientation();
    }
  }

  /**
   * 处理竖直方向状态
   */
  handleVerticalOrientation() {
    if (!this.orientationStableStartTime) {
      this.orientationStableStartTime = Date.now();
      console.log("📱 设备开始竖直");
    } else {
      const stableDuration = Date.now() - this.orientationStableStartTime;
      const progress = Math.min(
        (stableDuration / this.STABLE_DURATION) * 100,
        100
      );
      this.statusIndicator.textContent = `保持稳定... ${Math.floor(progress)}%`;

      if (stableDuration >= this.STABLE_DURATION) {
        this.completePlacement();
      }
    }
  }

  /**
   * 处理非竖直方向状态
   */
  handleNonVerticalOrientation() {
    if (this.orientationStableStartTime) {
      console.log("📱 设备移动，重置计时");
      this.orientationStableStartTime = null;
      this.statusIndicator.textContent = "保持手机竖直...";
    }
  }

  /**
   * 完成放置
   */
  completePlacement() {
    this.hasPlaced = true;
    this.statusIndicator.textContent = "✅ 已放置";
    console.log("✅ 自动放置完成");

    // 2秒后隐藏状态指示器
    setTimeout(() => {
      this.statusIndicator.classList.add("hidden");
    }, 2000);

    // 调用回调函数
    if (this.onPlacedCallback) {
      this.onPlacedCallback();
    }
  }

  /**
   * 获取是否已放置
   */
  isPlaced() {
    return this.hasPlaced;
  }

  /**
   * 重置状态，重新开始检测流程
   */
  reset() {
    console.log("🔄 Resetting orientation checker...");
    this.hasPlaced = false;
    this.orientationStableStartTime = null;
    this.statusIndicator.textContent = "保持手机竖直...";
    this.statusIndicator.classList.remove("hidden");
  }
}
