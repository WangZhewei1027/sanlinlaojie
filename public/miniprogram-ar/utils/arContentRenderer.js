// utils/arContentRenderer.js

/**
 * AR内容渲染器
 * 负责在xr-frame场景中动态创建和管理AR内容
 */
class ARContentRenderer {
  constructor(scene) {
    this.scene = scene;
    this.xrSystem = wx.getXrFrameSystem();
    this.contentNodes = []; // 存储所有创建的内容节点
    this.contentRoot = null; // 内容根节点
  }

  /**
   * 设置内容根节点
   * @param {Object} rootNode - xr-frame根节点
   */
  setContentRoot(rootNode) {
    this.contentRoot = rootNode;
  }

  /**
   * 清除所有AR内容
   */
  clearAll() {
    console.log(`🗑️ Clearing ${this.contentNodes.length} AR content nodes...`);

    this.contentNodes.forEach((node) => {
      if (node && node.el) {
        node.el.remove();
      }
    });

    this.contentNodes = [];
  }

  /**
   * 渲染图片内容
   * @param {Object} asset - 资产对象
   * @param {Object} position - 位置 {x, y, z}
   */
  renderImage(asset, position) {
    try {
      console.log(`🖼️ Rendering image asset ${asset.id} at`, position);

      // 创建图片节点
      const imageNode = this.scene.createElement(this.xrSystem.XRNode, {
        position: `${position.x} ${position.y} ${position.z}`,
      });

      // 使用 Mesh + 材质来显示图片
      const imageMesh = this.scene.createElement(this.xrSystem.XRMesh, {
        geometry: "plane",
        "node-id": `image-mesh-${asset.id}`,
        material: "unlit-mat", // 使用无光照材质
        scale: [1, 1, 1],
        uniforms: `u_baseColorMap: ${asset.file_url}`, // 设置贴图
      });

      imageNode.addChild(imageMesh);

      // 添加到根节点
      if (this.contentRoot && typeof this.contentRoot.addChild === "function") {
        this.contentRoot.addChild(imageNode);
      } else {
        console.error("❌ contentRoot is invalid:", {
          exists: !!this.contentRoot,
          type: typeof this.contentRoot,
          hasAddChild: this.contentRoot
            ? typeof this.contentRoot.addChild
            : "N/A",
        });
        throw new Error("contentRoot is not available or invalid");
      }

      // 记录节点
      this.contentNodes.push({
        id: asset.id,
        type: "image",
        el: imageNode,
      });

      console.log(`✅ Image asset ${asset.id} rendered`);
    } catch (error) {
      console.error(`❌ Error rendering image asset ${asset.id}:`, error);
    }
  }

  /**
   * 渲染文字内容
   * @param {Object} asset - 资产对象
   * @param {Object} position - 位置 {x, y, z}
   */
  renderText(asset, position) {
    try {
      console.log(`📝 Rendering text asset ${asset.id} at`, position);

      const text = asset.text_content || "(无内容)";

      // 创建文字背景（使用mesh）
      const textNode = this.scene.createElement(this.xrSystem.XRNode, {
        position: `${position.x} ${position.y} ${position.z}`,
      });

      // 创建文字背景平面
      const bgMesh = this.scene.createElement(this.xrSystem.XRMesh, {
        geometry: "plane",
        "node-id": `text-bg-${asset.id}`,
        material: "standard-mat",
        scale: [0.8, 0.6, 1],
        uniforms: "u_baseColorFactor:1 1 1 0.9", // 白色半透明
      });

      textNode.addChild(bgMesh);

      // TODO: xr-frame没有原生文字组件，需要使用texture或其他方式渲染文字
      // 这里暂时只创建背景

      // 添加到根节点
      if (this.contentRoot && typeof this.contentRoot.addChild === "function") {
        this.contentRoot.addChild(textNode);
      } else {
        console.error("❌ contentRoot is invalid:", {
          exists: !!this.contentRoot,
          type: typeof this.contentRoot,
          hasAddChild: this.contentRoot
            ? typeof this.contentRoot.addChild
            : "N/A",
        });
        throw new Error("contentRoot is not available or invalid");
      }

      // 记录节点
      this.contentNodes.push({
        id: asset.id,
        type: "text",
        el: textNode,
      });

      console.log(`✅ Text asset ${asset.id} rendered (${text.length} chars)`);
    } catch (error) {
      console.error(`❌ Error rendering text asset ${asset.id}:`, error);
    }
  }

  /**
   * 渲染音频内容
   * @param {Object} asset - 资产对象
   * @param {Object} position - 位置 {x, y, z}
   */
  renderAudio(asset, position) {
    try {
      console.log(`🔊 Rendering audio asset ${asset.id} at`, position);

      // 创建音频可视化节点（小球）
      const audioNode = this.scene.createElement(this.xrSystem.XRNode, {
        position: `${position.x} ${position.y} ${position.z}`,
      });

      // 创建球体mesh表示音频
      const sphereMesh = this.scene.createElement(this.xrSystem.XRMesh, {
        geometry: "sphere",
        "node-id": `audio-sphere-${asset.id}`,
        material: "standard-mat",
        scale: [0.3, 0.3, 0.3],
        uniforms: "u_baseColorFactor:0.2 0.6 1.0 1.0", // 蓝色
      });

      audioNode.addChild(sphereMesh);

      // TODO: 添加音频播放功能
      // 微信小程序可以使用 wx.createInnerAudioContext()

      // 添加到根节点
      if (this.contentRoot && typeof this.contentRoot.addChild === "function") {
        this.contentRoot.addChild(audioNode);
      } else {
        console.error("❌ contentRoot is invalid:", {
          exists: !!this.contentRoot,
          type: typeof this.contentRoot,
          hasAddChild: this.contentRoot
            ? typeof this.contentRoot.addChild
            : "N/A",
        });
        throw new Error("contentRoot is not available or invalid");
      }

      // 记录节点
      this.contentNodes.push({
        id: asset.id,
        type: "audio",
        el: audioNode,
        audioUrl: asset.file_url,
      });

      console.log(`✅ Audio asset ${asset.id} rendered`);
    } catch (error) {
      console.error(`❌ Error rendering audio asset ${asset.id}:`, error);
    }
  }

  /**
   * 创建文字纹理（Canvas方式）
   * @param {string} text - 文字内容
   * @returns {string} base64图片数据
   */
  createTextTexture(text) {
    // 注意：微信小程序中需要使用 Canvas 2D API
    // 这个方法需要在小程序环境中实现
    // 返回base64格式的图片数据

    // TODO: 实现Canvas文字渲染
    return null;
  }

  /**
   * 获取所有内容节点
   * @returns {Array} 内容节点列表
   */
  getContentNodes() {
    return this.contentNodes;
  }

  /**
   * 更新动画（每帧调用）
   * @param {number} delta - 时间增量
   */
  updateAnimations(delta) {
    // 可以在这里添加动画效果，例如音频节点的脉冲效果
    this.contentNodes.forEach((node) => {
      if (node.type === "audio" && node.el) {
        // 音频节点脉冲动画
        const time = Date.now() / 1000;
        const scale = 0.3 + Math.sin(time * 2) * 0.05;
        // node.el.scale.setValue(scale, scale, scale);
      }
    });
  }
}

module.exports = ARContentRenderer;
