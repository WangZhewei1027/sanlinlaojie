# 合集地图与投放交互

`/manage/collections/[id]` 是单个地图合集的编辑器。合集沿用 workspace UUID，由路由显式提供团队和合集；`/manage` 默认进入基础素材。素材和 Scene 属于团队，地图操作对象是 Placement。

## 模块边界

| 模块 | 职责 |
| --- | --- |
| [PlacementMapView](../app/manage/components/placements/PlacementMapView.tsx) | 组合投放列表、Cesium iframe 和侧栏，接收合集能力 |
| [usePlacementData](../app/manage/components/placements/usePlacementData.ts) | 按团队/合集加载投放及内容，处理读取取消与刷新 |
| [placement-store](../app/manage/lib/placement-store.ts) | 当前范围、投放、内容缓存、选择与刷新状态 |
| [placement-to-viewer](../app/manage/lib/placement-to-viewer.ts) | 将投放转换为 viewer 可读的字段 |
| [usePlacementViewer](../app/manage/hooks/usePlacementViewer.ts) | iframe 消息、相机定位、选中和拖动保存 |
| `public/js/viewer/` | 独立 Cesium 运行时，管理图标、选择和渲染资源 |

`GET /api/placements/[id]/content` 解析源素材或场景的当前内容。内容缓存按团队/合集、投放及目标标识匹配；素材锁版本也参与素材目标的缓存键。无坐标或目录型 Shop 可出现在列表，但不进入地图。

## ID 与消息

发送给 viewer 的 `id`、返回消息中的 `assetId` 和 `assetIds` 均指 **Placement ID**。基础素材的身份单独放在 `sourceAssetId`，场景身份放在 `sceneId`。同一素材在两个合集的投放是两个独立实例。

消息封装使用 `{ type, payload, source, version: 1 }`，source 为 manage 或 viewer。

| 方向 | type | 作用 |
| --- | --- | --- |
| 父 → 子 | SET_ORIGIN | 设置地图中心 |
| 父 → 子 | SET_ASSETS | 同步转换后的投放列表 |
| 父 → 子 | FOCUS_ASSET | 定位到指定投放及其坐标 |
| 父 → 子 | SET_SELECTION / CLEAR_SELECTION | 同步或清空多选 |
| 子 → 父 | VIEWER_READY | viewer 初始化完成，父级重发状态 |
| 子 → 父 | LOCATION_CLICKED | 更新手动选点坐标 |
| 子 → 父 | ASSET_CLICKED / ASSETS_SELECTED | 更新投放选中状态 |
| 子 → 父 | ASSETS_MOVED | 提交拖动后的投放坐标 |

## 写入与恢复

拖动通过 `POST /api/placements/move` 保存，逐项发送 `placementId`、`expectedLockVersion` 和坐标，批次原子处理。前端先检查能力，服务端再次验证团队、合集、状态及锁版本。

拒绝或失败时重发 SET_ASSETS 恢复地图位置；锁冲突会提示并请求重新加载。归档投放不删除源素材；暂停或归档后停止公开发现。来源选择器使用团队素材及已保存场景，编辑源内容无需“升级投放”。

匹配点素材 ID 通过适配器映射为该列表中的匹配点投放 ID，再写入 viewer 的 `anchor_id`。业务关联和识别规则见 [匹配点说明](anchor-matching.md)。

## 验证

修改消息桥时检查定位、单选/多选、手动选点、拖动保存、锁冲突恢复和合集切换。viewer 的重复同步及资源释放由 `node scripts/test-viewer-resources.mjs` 覆盖；它不替代浏览器消息桥和数据库写入验证。
