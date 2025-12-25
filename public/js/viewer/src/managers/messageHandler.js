/**
 * 消息通信处理模块
 */

import { displayAssets, focusOnAsset } from "./assetManager.js";

/**
 * 监听来自父窗口的消息
 */
export function setupMessageListener() {
  window.addEventListener("message", handleMessage);
  console.log("消息监听器已设置");
}

/**
 * 处理接收到的消息
 * @param {MessageEvent} event - 消息事件
 */
function handleMessage(event) {
  if (event.data?.source === "manage") {
    const { type, payload } = event.data;

    switch (type) {
      case "SET_ASSETS":
        displayAssets(payload);
        break;
      case "FOCUS_ASSET":
        focusOnAsset(payload);
        break;
      default:
        console.log("未知消息类型:", type);
    }
  }
}

/**
 * 向父窗口发送消息
 * @param {string} type - 消息类型
 * @param {Object} payload - 消息负载
 */
export function sendMessageToParent(type, payload) {
  if (window.parent !== window) {
    window.parent.postMessage(
      {
        type,
        payload,
        source: "viewer",
        version: 1,
      },
      "*"
    );
  }
}

/**
 * 发送位置点击事件到父窗口
 * @param {number} longitude - 经度
 * @param {number} latitude - 纬度
 * @param {number} height - 高度
 */
export function sendLocationClicked(longitude, latitude, height) {
  sendMessageToParent("LOCATION_CLICKED", {
    longitude,
    latitude,
    height,
  });

  console.log(
    `点击坐标: ${longitude.toFixed(6)}°, ${latitude.toFixed(
      6
    )}°, ${height.toFixed(2)}m`
  );
}
