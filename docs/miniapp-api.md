# 小程序接口（`/api/miniapp/*`）

微信小程序 `xr-frame-plant-trees` 通过这些**匿名**接口访问后端（`miniprogram/utils/backend.ts`），取代了原先用公开 anon key 直连 Supabase 的方式。接口保留原请求字段与播放 DTO；内容来源按组织迁移状态区分 legacy Asset 与 v2 Placement。数据库的新文档格式不会直接暴露给旧播放器。

- 基址：`https://spatialmemory.online`（`proxy.ts` 对 `/api/miniapp` 前缀放行，无需登录）
- 所有响应 `Cache-Control: no-store`
- 参数错误返回 `400 { error }`；数据库不可用返回 `503 { error }`
- 微信后台「服务器域名」需要：request / uploadFile 合法域名 `https://spatialmemory.online`；downloadFile 合法域名加上媒体域名 `https://sanlinlaojie-media.oss-cn-shanghai.aliyuncs.com`（以后换成 `media.spatialmemory.online`）

| 接口 | 取代 | 说明 |
|---|---|---|
| `GET /api/miniapp/organizations?ids=a,b` | `organization` 表读取 | 返回 `[{ id, name, config }]`；`config` 只包含 `confetti_enabled`、`shop_checkin_enabled`、`footer_enabled`、`text_asset_miniapp_style`。最多 50 个 id |
| `GET /api/miniapp/workspaces?ids=a,b` | `workspace` 表读取 | 返回 `[{ id, name }]` |
| `POST /api/miniapp/assets/nearby` | RPC `get_nearby_assets` | 请求体 `{ user_lat, user_lng, max_distance_meters (≤5000), p_workspace_id?, p_organization_id? }`，返回函数的行 |
| `POST /api/miniapp/assets/huge` | RPC `get_huge_assets` | `{ p_organization_id, p_workspace_id? }` |
| `POST /api/miniapp/assets/scene` | 场景播放清单 | `{ asset_id, p_workspace_id?, p_organization_id? }`，至少一个范围；返回 schema 1/2 清单，assetId 必须等于发现 ID |
| `POST /api/miniapp/shops` | RPC `get_shop_assets` | `{ p_workspace_id, p_organization_id }` |
| `POST /api/miniapp/text-assets` | RPC `upload_text_asset` | `{ content (≤500 字), p_workspace_id, p_organization_id?, user_lat?, user_lng? }`，返回函数的 json。**新增限流**：每 IP 每分钟 20 次、每工作空间每分钟 120 次（超出 `429`）；工作空间不存在 `404` |
| `POST /api/miniapp/anchors/recognize?workspace_id=` | Supabase Edge Function `recognize-anchor` | multipart：`image`、`latitude`、`longitude`、`accuracy`、`gps_timestamp`、`coordinate_system=wgs84`；可带 `X-Recognition-Request-Id`，响应头与 `data.request_id` 回显；错误体含 `code`、`retry_after_ms`、`diagnostics`。可带 `X-Client-Id`（16–64 位 `[A-Za-z0-9_-]`，小程序随机生成并本地保存）。限流两层：每设备每分钟 90 次（无合法 `X-Client-Id` 时按 IP，进程内存计数，超出 `429 client_rate_limited`，`retry_after_ms` 为窗口剩余时间）；每工作空间每分钟 3000 次（数据库计数，超出 `429 workspace_rate_limited`） |

实现：`app/api/miniapp/**/route.ts`，公共校验在 `lib/miniapp/request.ts`，限流在 `lib/miniapp/rate-limit.ts`（进程内存，单实例；多实例前需更换共享计数方案）。Legacy SQL 函数保留兼容职责，但已切换组织不能再由旧函数返回旧 Asset；v2 运行内容由 `lib/placements/runtime.server.ts` 解析，见下文。

## V2 运行内容与公开 ID

`scopeState` 从 Workspace 或 Organization 确定范围，两个参数同时传入时必须相符。公开解析只返回未归档组织、未归档所属项目中的 active Placement，并检查旧 scope 是否仍有效。素材目录 visibility/grant 用于团队管理，不能单独令内容上线，也不替代投放公开范围检查。

| 服务函数 | 投影来源 |
| --- | --- |
| `nearbyPlacements` | GPS 范围内的 active 投放及其固定版本 |
| `hugePlacements` | 固定模型版本与投放的 is_huge 配置 |
| `anchorPlacements` | 已识别 Anchor 关联的 active 投放 |
| `shopPlacements` | Shop 兼容内容；允许无 GPS 的目录型投放 |
| `sceneManifest` | 已发布 SceneRevision，经 compileSceneManifest 编译 |
| `submitAnonymousText` | 受限的文字版本与投放创建命令 |

新投放默认以 Placement ID 作为公开 ID。迁移内容通过
`legacy_runtime_binding` 保留旧 public_id，并由 `legacy_content_map` 保存旧项目发现范围和标签；管理地图仍操作独立 Placement ID。同组织多项目旧内容可共用 canonical 投放，组织查询去重，不生成重复展示。Shop 的旧 public_id 保留小程序本地打卡记录。

源码 Asset ID、Scene ID、管理 Placement ID、公开发现 ID 是不同职责。`assets/scene` 使用发现 ID 查询启用投放，不允许直接传 SceneRevision ID 绕过公开范围。暂停投放、归档所属项目/组织后，旧公开 ID 也不能继续绕过检查。

## 媒体

Legacy 的 `file_url` 保存 OSS 地址；v2 根据固定 `asset_version_resource` 解析播放 URL，再投影成旧字段。投放不会因为素材 current 版本变化而更新。

迁移版本的 `payload.migration_legacy` 冻结旧 nested metadata/config 等兼容数据，运行时合并为旧播放器字段；位置以 Placement 为准，主文件和打卡文件以固定版本资源为准。该字段仅供迁移，不是新素材 API 的可写扩展口。Link 继续返回 `config.link = LinkAssetData`，预览地址优先取固定版本的 thumbnail/primary 资源，再使用链接解析结果。

音频播放器仍遵循「同目录同名、扩展名换成 `.m4a`」的约定（`assets/audio.js`）。历史 `.webm` 的兼容文件需由转码流程处理并纳入保留集合；不能只登记主 URL 就清理同名 `.m4a`。见 [文件生命周期](asset-storage-lifecycle.md)。

## Scene 播放

发现记录仍使用 `file_type="scene"`。Legacy 模式读取旧场景的当前 composition 与模型；v2 读取 Placement 固定的 SceneRevision 和 AssetVersion，不读取可变 current URL。`lib/scene/compile.ts` 将内部 schema 3 转为 schema 1/2，保留实例/动画/曲线，回显 `manifest.assetId = 请求发现 ID`。详见 [Scene](scene-asset.md)。

普通素材直接投放固定版本，不包装为单节点 Scene。迁移模式在 Organization，不在 Workspace 上另造展示模式开关；二维码继续使用原 organizationId/workspaceId。

## 匿名文字与后续活动

文字请求保留原范围校验、长度限制与限流。V2 使用受限命令创建 `origin=public_submission`、restricted 的文字 Asset、v1 和 Placement；有 GPS 时为 active，无 GPS 时为 draft。该通道不会取得素材目录或场景编辑权限；readonly/归档组织禁止继续写入。

提交事务内会锁定并重新检查组织模式与项目归档状态，使并发切换到 readonly 时不能继续按旧预检查结果写入。

兼容写入身份只用于现有匿名文字，不是未来社交用户模型。种树活动的 Topic、Reply、种子账目尚未实现；未来由独立业务服务产生动态内容，通过展示适配接入。
