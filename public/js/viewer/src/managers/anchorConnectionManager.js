/**
 * 锚点连接线管理模块
 */

import { getViewer } from "./viewerManager.js";

let anchorLines = []; // 存储锚点关联线

/**
 * 创建锚点与关联资产之间的连接线
 * @param {Array} assets - 资产数组
 */
export function createAnchorConnectionLines(assets) {
  const viewer = getViewer();
  if (!viewer) return;

  // 创建一个 Map 用于快速查找资产
  const assetMap = new Map();
  assets.forEach((asset) => {
    if (
      asset.metadata.longitude !== undefined &&
      asset.metadata.latitude !== undefined
    ) {
      assetMap.set(asset.id, asset);
    }
  });

  // 遍历所有资产，为有 anchor_id 的资产创建连接线
  assets.forEach((asset) => {
    // 检查是否有关联的锚点
    if (
      asset.anchor_id &&
      asset.metadata.longitude !== undefined &&
      asset.metadata.latitude !== undefined
    ) {
      const anchor = assetMap.get(asset.anchor_id);

      if (
        anchor &&
        anchor.file_type === "anchor" &&
        anchor.metadata.longitude !== undefined &&
        anchor.metadata.latitude !== undefined
      ) {
        const assetPosition = Cesium.Cartesian3.fromDegrees(
          asset.metadata.longitude,
          asset.metadata.latitude,
          asset.metadata.height || 0
        );

        const anchorPosition = Cesium.Cartesian3.fromDegrees(
          anchor.metadata.longitude,
          anchor.metadata.latitude,
          anchor.metadata.height || 0
        );

        // 创建连接线
        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [assetPosition, anchorPosition],
            width: 2,
            material: Cesium.Color.RED.withAlpha(0.8),
            depthFailMaterial: Cesium.Color.RED.withAlpha(0.4), // 被遮挡时的材质
            clampToGround: false,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            arcType: Cesium.ArcType.NONE, // 直线连接
          },
          properties: {
            assetId: asset.id,
            anchorId: asset.anchor_id,
            connectionType: "anchor-asset",
          },
        });

        anchorLines.push(lineEntity);

        console.log(`创建关联线: ${asset.id} -> ${asset.anchor_id}`);
      }
    }
  });

  console.log(`共创建 ${anchorLines.length} 条锚点连接线`);
}

/**
 * 清除所有锚点连接线
 */
export function clearAnchorConnectionLines() {
  const viewer = getViewer();
  if (!viewer) return;

  anchorLines.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  anchorLines = [];

  console.log("已清除所有锚点连接线");
}

/**
 * 获取所有锚点连接线
 * @returns {Array} - 连接线数组
 */
export function getAnchorLines() {
  return anchorLines;
}
