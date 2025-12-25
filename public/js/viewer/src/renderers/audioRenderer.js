/**
 * Audio渲染模块 - 专门处理音频资源的绘制
 */

import { BILLBOARD_CONFIG } from "../utils/config.js";

/**
 * 创建音频canvas
 * @param {string} name - 音频文件名
 * @param {Object} metadata - 音频元数据（可选，包含duration等）
 * @returns {HTMLCanvasElement} - Canvas元素
 */
export function createAudioCanvas(name, metadata) {
  const iconSize = BILLBOARD_CONFIG.iconSize * 1.2;
  const padding = 4;
  const fontSize = 14;

  // 创建临时 canvas 测量文本宽度
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = `bold ${fontSize}px Arial`;

  // 显示名称或时长信息
  let displayText = "";
  if (name) {
    displayText = name;
  } else if (metadata?.duration) {
    const minutes = Math.floor(metadata.duration / 60);
    const seconds = Math.floor(metadata.duration % 60);
    displayText = `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const textWidth = displayText ? tempCtx.measureText(displayText).width : 0;

  // 计算 canvas 尺寸
  const canvasWidth = Math.max(iconSize, textWidth + padding * 2);
  const canvasHeight = iconSize + (displayText ? fontSize + padding * 2 : 0);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  const centerX = canvasWidth / 2;
  const iconCenterY = iconSize / 2;

  // 绘制圆形背景
  ctx.fillStyle = "#a855f7"; // 紫色
  ctx.beginPath();
  ctx.arc(centerX, iconCenterY, iconSize / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  // 绘制白色边框
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 绘制喇叭 emoji
  ctx.font = `${iconSize * 0.7}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔊", centerX, iconCenterY);

  // 如果有显示文本，在底部绘制
  if (displayText) {
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
    ctx.fillText(displayText, centerX, textY);
  }

  console.log(
    `创建音频canvas: "${
      displayText || "无名称"
    }", 尺寸: ${canvasWidth}x${canvasHeight}`
  );

  return canvas;
}
