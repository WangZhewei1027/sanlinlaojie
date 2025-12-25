/**
 * Anchor渲染模块 - 专门处理锚点的绘制
 */

import { BILLBOARD_CONFIG } from "./config.js";

/**
 * 创建锚点canvas
 * @param {string} name - 锚点名称
 * @param {string} text - 可选的锚点描述文本
 * @returns {HTMLCanvasElement} - Canvas元素
 */
export function createAnchorCanvas(name, text) {
  const iconSize = BILLBOARD_CONFIG.iconSize * 1.2;
  const padding = 4;
  const fontSize = 14;

  // 创建临时 canvas 测量文本宽度
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = `bold ${fontSize}px Arial`;
  const textWidth = name ? tempCtx.measureText(name).width : 0;

  // 计算 canvas 尺寸
  const canvasWidth = Math.max(iconSize, textWidth + padding * 2);
  const canvasHeight = iconSize + (name ? fontSize + padding * 2 : 0);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  const centerX = canvasWidth / 2;
  const iconCenterY = iconSize / 2;

  // 绘制圆形背景
  ctx.fillStyle = "#f59e0b"; // 金色
  ctx.beginPath();
  ctx.arc(centerX, iconCenterY, iconSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  // 绘制白色边框
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 绘制锚点 emoji
  ctx.font = `${iconSize * 0.75}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚓", centerX, iconCenterY);

  // 如果有 name，在底部绘制
  if (name) {
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = "#1f2937"; // 深色文本
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // 绘制文本背景（半透明白色）
    const textY = iconSize + padding;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(0, iconSize, canvasWidth, fontSize + padding * 2);

    // 绘制文本
    ctx.fillStyle = "#1f2937";
    ctx.fillText(name, centerX, textY);
  }

  console.log(
    `创建锚点canvas: "${name || "无名称"}"${
      text ? `, 描述: "${text}"` : ""
    }, 尺寸: ${canvasWidth}x${canvasHeight}`
  );

  return canvas;
}
