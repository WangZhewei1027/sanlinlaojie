/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 文字Mesh创建器
 * 负责创建带有文字纹理的3D文字卡片
 */
class TextMeshCreator {
  /**
   * 创建文字mesh（圆角方块）
   * @param {Object} asset - 资产对象
   * @param {number} angle - 初始角度
   * @returns {THREE.Mesh} 文字mesh
   */
  static create(asset, angle) {
    const text = asset.text_content || "(无内容)";

    // 计算文本需要的尺寸
    const { width, height, canvasWidth, canvasHeight } =
      this.calculateTextDimensions(text);

    // 创建自适应高度的几何体
    const geometry = new THREE.BoxGeometry(width, height, 0.1, 8, 8, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.angle = angle;
    mesh.userData.assetId = asset.id;
    mesh.userData.assetType = "text";

    // 创建文字纹理
    const texture = this.createTextTexture(text, canvasWidth, canvasHeight);
    material.map = texture;
    material.needsUpdate = true;

    console.log(
      `✅ Created text mesh for asset ${asset.id} (${width.toFixed(
        2
      )}m × ${height.toFixed(2)}m)`
    );

    return mesh;
  }

  /**
   * 计算文本需要的尺寸
   * @param {string} text - 文本内容
   * @returns {Object} {width, height, canvasWidth, canvasHeight}
   */
  static calculateTextDimensions(text) {
    // 创建临时canvas来测量文本
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");
    tempContext.font = "bold 28px Arial, sans-serif";

    const baseWidth = 512;
    const padding = {
      top: 30,
      right: 30,
      bottom: 30,
      left: 30,
    };

    const contentWidth = baseWidth - padding.left - padding.right;
    const lineHeight = 36;

    // 计算需要多少行
    const chars = text.split("");
    let lines = 1;
    let currentLine = "";

    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];
      const metrics = tempContext.measureText(testLine);

      if (metrics.width > contentWidth && currentLine.length > 0) {
        lines++;
        currentLine = chars[i];
      } else {
        currentLine = testLine;
      }
    }

    // 计算所需高度
    const minLines = 2; // 最少2行的高度
    const maxLines = 10; // 最多10行的高度
    const effectiveLines = Math.max(minLines, Math.min(lines, maxLines));

    const contentHeight = effectiveLines * lineHeight;
    const canvasHeight = contentHeight + padding.top + padding.bottom;

    // 3D mesh的尺寸（以米为单位）
    const meshWidth = 0.8; // 固定宽度
    const meshHeight = meshWidth * (canvasHeight / baseWidth); // 根据canvas比例计算高度

    return {
      width: meshWidth,
      height: meshHeight,
      canvasWidth: baseWidth,
      canvasHeight: canvasHeight,
    };
  }

  /**
   * 创建文字纹理
   * @param {string} text - 要显示的文字
   * @param {number} canvasWidth - Canvas宽度
   * @param {number} canvasHeight - Canvas高度
   * @returns {THREE.CanvasTexture} Canvas纹理
   */
  static createTextTexture(text, canvasWidth, canvasHeight) {
    // 创建canvas来绘制文字
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Padding配置（类似flexbox）
    const padding = {
      top: 30,
      right: 30,
      bottom: 30,
      left: 30,
    };

    // 背景（圆角矩形）
    context.fillStyle = "#ffffff";
    this.drawRoundedRect(
      context,
      0,
      0,
      canvas.width,
      canvas.height,
      15 // 圆角半径
    );
    context.fill();

    // 绘制文字
    context.fillStyle = "#000000";
    context.font = "bold 28px Arial, sans-serif";

    // 自动换行并居中
    this.drawWrappedText(context, text, canvas.width, canvas.height, padding);

    // 将canvas作为纹理
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * 绘制圆角矩形
   * @param {CanvasRenderingContext2D} context - Canvas上下文
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} radius - 圆角半径
   */
  static drawRoundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  /**
   * 绘制自动换行的文字（带padding，自适应）
   * @param {CanvasRenderingContext2D} context - Canvas上下文
   * @param {string} text - 要绘制的文字
   * @param {number} canvasWidth - Canvas宽度
   * @param {number} canvasHeight - Canvas高度
   * @param {Object} padding - Padding配置 {top, right, bottom, left}
   */
  static drawWrappedText(context, text, canvasWidth, canvasHeight, padding) {
    // 计算可用区域
    const contentWidth = canvasWidth - padding.left - padding.right;
    const contentHeight = canvasHeight - padding.top - padding.bottom;

    // 将文本按字符分割（支持中英文混合）
    const chars = text.split("");
    const lines = [];
    let currentLine = "";
    const lineHeight = 36; // 行高

    // 分行
    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];
      const metrics = context.measureText(testLine);

      if (metrics.width > contentWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = chars[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // 计算总文本高度
    const totalTextHeight = lines.length * lineHeight;

    // 垂直居中：计算起始Y坐标
    let startY =
      padding.top + (contentHeight - totalTextHeight) / 2 + lineHeight / 2;

    // 如果文本太多，从顶部开始
    if (totalTextHeight > contentHeight) {
      startY = padding.top + lineHeight / 2;
    }

    // 绘制每一行（水平居中）
    context.textAlign = "center";
    context.textBasline = "middle";

    lines.forEach((line, index) => {
      const x = canvasWidth / 2; // 水平居中
      const y = startY + index * lineHeight;

      // 只绘制在可见区域内的行
      if (y >= padding.top && y <= canvasHeight - padding.bottom) {
        context.fillText(line, x, y);
      }
    });
  }
}
