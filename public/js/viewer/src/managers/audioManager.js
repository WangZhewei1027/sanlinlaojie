/**
 * 音频播放管理模块
 * 根据相机距离自动播放/停止音频
 */

import { getViewer } from "./viewerManager.js";
import { getDistanceToEntity } from "../utils/lodManager.js";

// 音频距离配置（米）
export const AUDIO_CONFIG = {
  // 音频开始播放的距离
  playDistance: 15,
  // 音频停止播放的距离（添加一些滞后，避免频繁切换）
  stopDistance: 20,
  // 最大音量距离（此距离内音量为1）
  maxVolumeDistance: 5,
  // 音量衰减曲线类型：'linear'（线性）或 'exponential'（指数）
  volumeCurve: "exponential",
  // 更新频率（毫秒）
  updateInterval: 500,
};

// 存储音频实例
const audioInstances = new Map(); // Map<assetId, {audio: HTMLAudioElement, entity: Cesium.Entity, isPlaying: boolean}>

let updateTimer = null;

/**
 * 注册音频资产
 * @param {Object} asset - 音频资产对象
 * @param {Cesium.Entity} entity - 对应的Cesium实体
 */
export function registerAudioAsset(asset, entity) {
  if (asset.file_type !== "audio" || !asset.file_url) {
    return;
  }

  // 如果已经注册过，跳过
  if (audioInstances.has(asset.id)) {
    console.log(`音频已注册: ${asset.id}`);
    return;
  }

  // 创建音频元素
  const audio = new Audio(asset.file_url);
  audio.loop = true; // 循环播放
  audio.volume = 0; // 初始音量为0

  // 存储音频实例
  audioInstances.set(asset.id, {
    audio,
    entity,
    asset,
    isPlaying: false,
    lastDistance: Infinity,
  });

  console.log(`注册音频资产: ${asset.id}, URL: ${asset.file_url}`);
}

/**
 * 注销音频资产
 * @param {string} assetId - 资产ID
 */
export function unregisterAudioAsset(assetId) {
  const instance = audioInstances.get(assetId);
  if (instance) {
    // 停止播放并释放资源
    instance.audio.pause();
    instance.audio.src = "";
    audioInstances.delete(assetId);
    console.log(`注销音频资产: ${assetId}`);
  }
}

/**
 * 清除所有音频资产
 */
export function clearAllAudio() {
  audioInstances.forEach((instance, assetId) => {
    unregisterAudioAsset(assetId);
  });
  stopAudioUpdate();
  console.log("已清除所有音频资产");
}

/**
 * 计算音量（根据距离）
 * @param {number} distance - 距离（米）
 * @returns {number} - 音量（0-1）
 */
function calculateVolume(distance) {
  if (distance <= AUDIO_CONFIG.maxVolumeDistance) {
    return 1.0;
  }

  if (distance >= AUDIO_CONFIG.playDistance) {
    return 0;
  }

  // 计算衰减比例
  const range = AUDIO_CONFIG.playDistance - AUDIO_CONFIG.maxVolumeDistance;
  const normalizedDistance =
    (distance - AUDIO_CONFIG.maxVolumeDistance) / range;

  if (AUDIO_CONFIG.volumeCurve === "exponential") {
    // 指数衰减（更符合现实声音传播）
    return Math.pow(1 - normalizedDistance, 2);
  } else {
    // 线性衰减
    return 1 - normalizedDistance;
  }
}

/**
 * 更新单个音频实例
 * @param {string} assetId - 资产ID
 * @param {Object} instance - 音频实例对象
 */
function updateAudioInstance(assetId, instance) {
  const { audio, entity, isPlaying } = instance;

  // 计算当前距离
  const distance = getDistanceToEntity(entity);
  instance.lastDistance = distance;

  // 根据距离决定播放/停止
  if (distance <= AUDIO_CONFIG.playDistance) {
    // 在播放范围内
    if (!isPlaying) {
      // 开始播放
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            instance.isPlaying = true;
            console.log(
              `开始播放音频: ${assetId}, 距离: ${distance.toFixed(1)}m`
            );
          })
          .catch((error) => {
            console.warn(`音频播放失败: ${assetId}`, error);
          });
      }
    }

    // 更新音量
    const volume = calculateVolume(distance);
    audio.volume = volume;

    // 记录音量变化（仅用于调试）
    if (Math.abs(volume - (audio.lastLoggedVolume || 0)) > 0.1) {
      console.log(
        `音频 ${assetId} - 距离: ${distance.toFixed(
          1
        )}m, 音量: ${volume.toFixed(2)}`
      );
      audio.lastLoggedVolume = volume;
    }
  } else if (distance > AUDIO_CONFIG.stopDistance) {
    // 超出停止距离
    if (isPlaying) {
      audio.pause();
      instance.isPlaying = false;
      audio.volume = 0;
      console.log(`停止播放音频: ${assetId}, 距离: ${distance.toFixed(1)}m`);
    }
  }
  // 在 playDistance 和 stopDistance 之间时保持当前状态（滞后区间）
}

/**
 * 更新所有音频实例
 */
function updateAllAudio() {
  const viewer = getViewer();
  if (!viewer) {
    return;
  }

  audioInstances.forEach((instance, assetId) => {
    updateAudioInstance(assetId, instance);
  });
}

/**
 * 启动音频更新
 */
export function startAudioUpdate() {
  if (updateTimer) {
    return; // 已经启动
  }

  // 定时更新音频状态
  updateTimer = setInterval(() => {
    updateAllAudio();
  }, AUDIO_CONFIG.updateInterval);

  // 立即执行一次更新
  updateAllAudio();

  console.log(
    `音频更新已启动，间隔: ${AUDIO_CONFIG.updateInterval}ms，播放距离: ${AUDIO_CONFIG.playDistance}m`
  );
}

/**
 * 停止音频更新
 */
export function stopAudioUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
    console.log("音频更新已停止");
  }
}

/**
 * 获取当前注册的音频数量
 * @returns {number}
 */
export function getAudioCount() {
  return audioInstances.size;
}

/**
 * 设置音频配置
 * @param {Object} config - 配置对象
 */
export function setAudioConfig(config) {
  Object.assign(AUDIO_CONFIG, config);
  console.log("音频配置已更新:", AUDIO_CONFIG);
}

/**
 * 获取音频状态信息（用于调试）
 * @returns {Array} - 音频状态数组
 */
export function getAudioStatus() {
  const status = [];
  audioInstances.forEach((instance, assetId) => {
    status.push({
      assetId,
      isPlaying: instance.isPlaying,
      distance: instance.lastDistance,
      volume: instance.audio.volume,
      url: instance.audio.src,
    });
  });
  return status;
}
