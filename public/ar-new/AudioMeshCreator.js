/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 音频Mesh创建器
 * 创建带有空间音频的呼吸球体
 */
class AudioMeshCreator {
  /**
   * 创建音频mesh
   * @param {Object} asset - 资产对象
   * @param {Object} position - 位置 {x, y, z}
   * @param {number} rotation - Y轴旋转角度（弧度）
   * @param {THREE.Camera} camera - 摄像机对象（用于空间音频）
   * @returns {THREE.Group} 音频mesh组
   */
  static create(asset, position, rotation, camera) {
    const group = new THREE.Group();
    group.userData.assetId = asset.id;
    group.userData.assetType = "audio";

    // 创建呼吸球体
    const sphere = this.createBreathingSphere();
    group.add(sphere);

    // 创建音频图标
    const icon = this.createAudioIcon();
    group.add(icon);

    // 设置位置
    group.position.set(position.x, position.y, position.z);
    group.rotation.y = rotation;

    // 添加空间音频
    if (asset.file_url && camera) {
      this.addSpatialAudio(group, asset.file_url, camera);
    }

    // 保存原始缩放，用于呼吸动画
    group.userData.originalScale = 1.0;
    group.userData.breathPhase = Math.random() * Math.PI * 2; // 随机初始相位

    return group;
  }

  /**
   * 创建呼吸球体
   * @returns {THREE.Mesh}
   */
  static createBreathingSphere() {
    const geometry = new THREE.SphereGeometry(0.15, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xa855f7, // 紫色
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.userData.isBreathingSphere = true;

    return sphere;
  }

  /**
   * 创建音频图标（使用canvas纹理）
   * @returns {THREE.Sprite}
   */
  static createAudioIcon() {
    // 创建canvas绘制音频图标
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // 绘制圆形背景
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    // 绘制音频图标（简化的喇叭形状）
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔊", 64, 64);

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // 创建sprite材质
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.2, 0.2, 1);
    sprite.userData.isAudioIcon = true;

    return sprite;
  }

  /**
   * 添加空间音频
   * @param {THREE.Group} group - 音频组
   * @param {string} audioUrl - 音频URL
   * @param {THREE.Camera} camera - 摄像机
   */
  static addSpatialAudio(group, audioUrl, camera) {
    try {
      // 创建音频监听器（如果还没有）
      if (!camera.userData.audioListener) {
        const listener = new THREE.AudioListener();
        camera.add(listener);
        camera.userData.audioListener = listener;
      }

      const listener = camera.userData.audioListener;

      // 创建空间音频
      const sound = new THREE.PositionalAudio(listener);

      // 加载音频
      const audioLoader = new THREE.AudioLoader();
      audioLoader.load(
        audioUrl,
        (buffer) => {
          sound.setBuffer(buffer);
          sound.setRefDistance(1); // 参考距离（米）
          sound.setRolloffFactor(4); // 衰减因子（越大衰减越快）
          sound.setDistanceModel("exponential"); // 指数衰减模型
          sound.setLoop(true); // 循环播放
          sound.setVolume(1); // 音量

          // 自动播放
          sound.play();

          console.log(
            `🔊 Loaded spatial audio for asset ${group.userData.assetId}`
          );
        },
        undefined,
        (error) => {
          console.error(
            `❌ Failed to load audio for asset ${group.userData.assetId}:`,
            error
          );
        }
      );

      // 将音频添加到组
      group.add(sound);
      group.userData.sound = sound;
    } catch (error) {
      console.error("❌ Error setting up spatial audio:", error);
    }
  }

  /**
   * 更新呼吸动画
   * @param {THREE.Group} group - 音频mesh组
   * @param {number} delta - 时间增量
   */
  static updateBreathingAnimation(group, delta) {
    if (!group.userData.breathPhase) return;

    // 更新呼吸相位
    group.userData.breathPhase += delta * 2; // 呼吸速度

    // 计算缩放（0.7 到 1.3 之间）
    const breathScale = 1.0 + Math.sin(group.userData.breathPhase) * 0.3;

    // 只缩放球体，不缩放图标
    group.children.forEach((child) => {
      if (child.userData.isBreathingSphere) {
        const baseScale = group.userData.originalScale || 1.0;
        child.scale.set(
          breathScale * baseScale,
          breathScale * baseScale,
          breathScale * baseScale
        );
      }
    });

    // 旋转图标使其始终面向摄像机
    group.children.forEach((child) => {
      if (child.userData.isAudioIcon) {
        // Sprite会自动面向摄像机
      }
    });
  }

  /**
   * 清理音频资源
   * @param {THREE.Group} group - 音频mesh组
   */
  static dispose(group) {
    // 停止并清理音频
    if (group.userData.sound) {
      if (group.userData.sound.isPlaying) {
        group.userData.sound.stop();
      }
      group.userData.sound.disconnect();
      group.userData.sound = null;
    }

    // 清理几何体和材质
    group.children.forEach((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (child.material.map) {
          child.material.map.dispose();
        }
        child.material.dispose();
      }
    });
  }
}
