/**
 * 选中管理模块
 * 维护地图上被选中的素材集合，并负责 billboard 高亮。
 * 选中集为模块级状态，跨 SET_ASSETS 重建保留（displayAssets 后由 messageHandler 重新套用高亮）。
 */

import { getAssetBillboards } from "./assetManager.js";

let selectedIds = new Set();
let onChange = null; // 选中变化回调（由 interactionManager 注册为 sendAssetsSelected）

const HIGHLIGHT_COLOR = Cesium.Color.YELLOW;
const NORMAL_COLOR = Cesium.Color.WHITE;

/**
 * 读取 billboard 实体上的 assetId（兼容 Property / 原始值）。
 */
function readAssetId(entity) {
  const p = entity?.properties?.assetId;
  if (!p) return undefined;
  return p.getValue ? p.getValue() : p;
}

/**
 * 注册选中变化回调。
 */
export function setOnSelectionChange(cb) {
  onChange = cb;
}

function notify() {
  if (onChange) onChange(Array.from(selectedIds));
}

export function getSelectedIds() {
  return Array.from(selectedIds);
}

export function isSelected(id) {
  return selectedIds.has(id);
}

/**
 * 设置选中集。
 * @param {string[]} ids
 * @param {{ silent?: boolean }} [opts] - silent 时不触发对外通知（用于父窗口同步）
 */
export function setSelection(ids, { silent = false } = {}) {
  selectedIds = new Set(ids);
  reapplyHighlight();
  if (!silent) notify();
}

/**
 * 切换单个素材的选中状态。
 */
export function toggleSelection(id, { silent = false } = {}) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  reapplyHighlight();
  if (!silent) notify();
}

/**
 * 清空选中。
 */
export function clearSelection({ silent = false } = {}) {
  if (selectedIds.size === 0) return;
  selectedIds.clear();
  reapplyHighlight();
  if (!silent) notify();
}

/**
 * 按当前选中集重新给所有 billboard 上色（LOD 只改 image/scale，不动 color，安全）。
 */
export function reapplyHighlight() {
  const billboards = getAssetBillboards();
  billboards.forEach((entity) => {
    if (!entity.billboard) return;
    const id = readAssetId(entity);
    entity.billboard.color = selectedIds.has(id)
      ? HIGHLIGHT_COLOR
      : NORMAL_COLOR;
  });
}
