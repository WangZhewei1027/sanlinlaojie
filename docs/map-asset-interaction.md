---
title: 地图与素材列表双向联动
created: 2026-05-10
updated: 2026-10-15
---

# 投放地图与 Legacy 素材地图

`/manage` 先读取组织内容模型状态：v2 使用 Placement 地图，legacy/preparing 保留旧 Asset 地图，readonly 冻结写入。状态未确定时不抢先显示可编辑界面，读取失败时保守进入只读。组织/项目 URL 上下文优先于持久化选择；`__all__` 仅用于聚合浏览，新建和复制需明确目标项目。

## V2：地图操作的是 Placement

| 边界 | 实现与约定 |
| --- | --- |
| 数据与选中状态 | `app/manage/lib/placement-store.ts`；与素材目录状态分开 |
| iframe 转换 | `app/manage/lib/placement-to-viewer.ts`；唯一的 Placement → 旧 viewer 数据适配 |
| 消息桥 | `app/manage/hooks/usePlacementViewer.ts`；继续使用 SET_ASSETS、ASSET_CLICKED、ASSETS_MOVED 等名字 |
| 移动保存 | `POST /api/placements/move`，逐项发送 placementId 和 expectedLockVersion，批次原子处理 |
| 固定内容 | 从目标 AssetVersion / SceneRevision 解析；不读取素材 current 版本来替换投放内容 |

管理地图通过 `GET /api/placements/[id]/content?workspace_id=…` 读取固定内容。
预览缓存按当前项目范围和投放目标校验，切换项目时清除并中止旧请求；源素材详情另行鉴权，只有成功读取后才显示目录与版本操作。共享投放不再依赖源素材目录的访问权限才能显示内容。

发给 viewer 的 `id` 是 Placement ID，返回的 `assetId` 也解释为 Placement ID。`sourceAssetId/assetVersionId/sceneRevisionId` 作为独立信息保留；不得再调用 Asset 移动/删除接口。小程序旧公开 ID 通过运行时绑定解析，不是管理地图 ID。

同一素材的两个投放可独立选中、移动、暂停、复制和升级。归档投放不会删除源素材；旧多项目 scope 显示为带来源项目的只读共享投放。地图按 capability 禁止无权限拖动；拒绝或保存失败时重发 SET_ASSETS 恢复位置，冲突时重新加载并提示用户。

列表可包含无坐标的目录型 Shop，但它不会进入地图。Anchor 继续使用专用业务适配。旧消息协议仍可复用，语义由当前模式决定，不能仅根据字段名 `assetId` 推断它属于 Asset。

## Legacy 交互参考

以下是旧地图 `useViewerMessaging` / `useManageStore` 的数据链路和消息说明；其 ID 才是旧 Asset ID。v2 共用 viewer 消息格式，不共用旧写入路径。

## 功能概述

管理页面（`/manage`）的地图（Cesium 查看器）与左侧素材列表（`AssetManager`）之间支持双向交互：

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
| `SET_SELECTION` | `{ assetIds }` | 父窗口同步多选集到地图（viewer 侧静默套用，不回传） |
| `CLEAR_SELECTION` | `{}` | 父级操作条"取消"后清除地图高亮 |

### 子 → 父

| `type` | `payload` | 触发时机 |
|---|---|---|
| `LOCATION_CLICKED` | `{ longitude, latitude, height }` | 点击地图空地时 |
| `ASSET_CLICKED` | `{ assetId }` | 点击素材图标时 |
| `ASSETS_MOVED` | `{ moves: [{ assetId, longitude, latitude, height }] }` | 拖动素材松手时；父窗口一次 `POST /api/assets/move` 批量落库并更新 store |
| `ASSETS_SELECTED` | `{ assetIds }` | 地图框选多选时；写入 store 的 `selectedAssetIds` |

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
