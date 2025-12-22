/**
 * Zappar Splash Screen Remover
 * 监听并自动删除 Zappar 的开屏动画
 */
class SplashScreenRemover {
  constructor(className = "zws0-h6oBaHkx") {
    this.className = className;
    this.observer = null;
    this.removed = false;
  }

  /**
   * 尝试删除开屏动画
   * @returns {boolean} 是否成功删除
   */
  remove() {
    const splashScreen = document.querySelector(`.${this.className}`);
    if (splashScreen) {
      splashScreen.remove();
      console.log("✅ Zappar splash screen removed");
      this.removed = true;
      return true;
    }
    return false;
  }

  /**
   * 开始监听并自动删除
   */
  start() {
    // 立即尝试删除（如果已存在）
    if (this.remove()) {
      return;
    }

    // 如果不存在，设置观察器监听 DOM 变化
    this.observer = new MutationObserver(() => {
      if (this.remove()) {
        this.stop();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log("👁️ MutationObserver watching for Zappar splash screen...");
  }

  /**
   * 停止监听
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * 是否已删除
   * @returns {boolean}
   */
  isRemoved() {
    return this.removed;
  }
}

// 自动启动（如果作为脚本直接引入）
if (typeof window !== "undefined") {
  window.SplashScreenRemover = SplashScreenRemover;
}
