---
title: 地图与素材列表双向联动
created: 2026-05-10
updated: 2026-05-10
---

# 地图与素材列表双向联动

## 功能概述

管理页面（`/manage`）的地图（Cesium 查看器）与左侧素材列表（AssetList）之间支持双向交互：

| 操作 | 效果 |
|---|---|
| 在素材列表点击 **定位** 按钮 | 地图相机飞到该素材所在位置 |
| 在地图上点击 **素材图标** | 素材列表自动高亮并滚动到对应卡片 |
| 在地图上点击 **空地** | 更新上传面板中的"手动选点"坐标，不影响素材选中状态 |

---

## 技术架构

管理页面通过 `<iframe>` 嵌入 Cesium 查看器，双方使用 `window.postMessage` 进行通信。所有消息都带有 `source` 字段用于区分来源，避免消息被错误处理。

```
┌─────────────────────────────────────────────┐
│              管理页面（父窗口）               │
│                                             │
│  useViewerMessaging (hooks)                 │
│  ┌───────────────────────────────────────┐  │
│  │  发送到 Viewer（source: "manage"）     │  │
│  │  SET_ORIGIN   → 设置地图中心          │  │
│  │  SET_ASSETS   → 同步素材列表          │  │
│  │  FOCUS_ASSET  → 定位到指定素材        │  │
│  │                                       │  │
│  │  接收自 Viewer（source: "viewer"）     │  │
│  │  LOCATION_CLICKED ← 空地点击坐标      │  │
│  │  ASSET_CLICKED    ← 素材图标点击 ID   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Store (Zustand)                            │
│    clickedLocation  → 上传定位使用           │
│    selectedAssetId  → 素材卡片高亮使用       │
└───────────────┬─────────────────────────────┘
                │ iframe 边界
┌───────────────▼─────────────────────────────┐
│           Cesium 查看器（子窗口）             │
│                                             │
│  clickHandler.js                            │
│    LEFT_CLICK                               │
│      命中素材 billboard → ASSET_CLICKED      │
│      命中空地           → LOCATION_CLICKED   │
│                                             │
│  messageHandler.js                          │
│    SET_ASSETS   → 渲染素材图标               │
│    FOCUS_ASSET  → 相机飞行                   │
│    SET_ORIGIN   → 设置初始视角               │
└─────────────────────────────────────────────┘
```

---

## 消息协议

### 父 → 子

| `type` | `payload` | 触发时机 |
|---|---|---|
| `SET_ORIGIN` | `{ lat, lng }` | 切换组织时 |
| `SET_ASSETS` | `Asset[]` | 素材列表变化（含过滤）时 |
| `FOCUS_ASSET` | `{ id, longitude, latitude, height }` | 点击定位按钮时 |

### 子 → 父

| `type` | `payload` | 触发时机 |
|---|---|---|
| `LOCATION_CLICKED` | `{ longitude, latitude, height }` | 点击地图空地时 |
| `ASSET_CLICKED` | `{ assetId }` | 点击素材图标时 |

所有消息格式：

```json
{
  "type": "...",
  "payload": {},
  "source": "manage" | "viewer",
  "version": 1
}
```

---

## 点击行为的冲突处理

地图点击事件在 `clickHandler.js` 中统一处理，通过 `viewer.scene.pick()` 优先判断是否命中素材实体：

```javascript
// clickHandler.js — handleMapClick
const picked = viewer.scene.pick(movement.position);
if (picked && picked.id?.properties?.assetId) {
  // 命中素材图标 → 发送 ASSET_CLICKED，直接返回
  sendAssetClicked(assetId);
  return;
}
// 未命中 → 地面坐标拾取 → 发送 LOCATION_CLICKED
sendLocationClicked(longitude, latitude, height);
```

**关键规则**：两类事件互斥，同一次点击只会触发其中一个，因此：
- 上传面板中的"手动选点"功能（依赖 `LOCATION_CLICKED`）不会因点击素材图标而被意外覆盖
- 素材选中状态（依赖 `ASSET_CLICKED`）不会因点击空地而被意外清除

---

## 素材列表自动滚动

当 `selectedAssetId` 在 Store 中更新时（无论是直接点击卡片，还是从地图触发），`AssetManager` 组件会自动将对应卡片滚动到可视区域：

```typescript
// AssetManager/index.tsx
useEffect(() => {
  if (!selectedAssetId) return;
  document
    .getElementById(`asset-card-${selectedAssetId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}, [selectedAssetId]);
```

每张 `AssetCard` 的容器 `<div>` 上有对应的 `id={`asset-card-${asset.id}`}` 属性。

---

## 涉及文件

| 文件 | 职责 |
|---|---|
| `public/js/viewer/src/managers/clickHandler.js` | 地图点击分发：实体点击 vs 空地点击 |
| `public/js/viewer/src/managers/messageHandler.js` | 向父窗口发送消息（`sendAssetClicked`、`sendLocationClicked`） |
| `app/manage/hooks/useViewerMessaging.ts` | 接收子窗口消息，更新 Store |
| `app/manage/store.ts` | `selectedAssetId`、`clickedLocation` 等共享状态 |
| `app/manage/components/AssetManager/index.tsx` | 监听 `selectedAssetId`，触发自动滚动 |
| `app/manage/components/AssetManager/AssetCard.tsx` | 渲染素材卡片，支持高亮与定位 |
| `app/manage/components/upload/location-selector.tsx` | 读取 `clickedLocation`，供上传时选点使用 |
