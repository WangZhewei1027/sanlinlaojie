# 小程序接口（`/api/miniapp/*`）

微信小程序 `xr-frame-plant-trees` 通过这些**匿名**接口访问后端（`miniprogram/utils/backend.ts`），取代了原先用公开 anon key 直连 Supabase 的方式。设计原则：**请求参数与返回结构与原来的 RPC / 表查询完全一致**，小程序只替换传输层，渲染代码不动。

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
| `POST /api/miniapp/shops` | RPC `get_shop_assets` | `{ p_workspace_id, p_organization_id }` |
| `POST /api/miniapp/text-assets` | RPC `upload_text_asset` | `{ content (≤500 字), p_workspace_id, p_organization_id?, user_lat?, user_lng? }`，返回函数的 json。**新增限流**：每 IP 每分钟 20 次、每工作空间每分钟 120 次（超出 `429`）；工作空间不存在 `404` |
| `POST /api/miniapp/anchors/recognize?workspace_id=` | Supabase Edge Function `recognize-anchor` | multipart：`image`、`latitude`、`longitude`、`accuracy`、`gps_timestamp`、`coordinate_system=wgs84`；可带 `X-Recognition-Request-Id`，响应头与 `data.request_id` 回显；错误体含 `code`、`retry_after_ms`、`diagnostics`。可带 `X-Client-Id`（16–64 位 `[A-Za-z0-9_-]`，小程序随机生成并本地保存）。限流两层：每设备每分钟 90 次（无合法 `X-Client-Id` 时按 IP，进程内存计数，超出 `429 client_rate_limited`，`retry_after_ms` 为窗口剩余时间）；每工作空间每分钟 600 次（数据库计数，超出 `429 workspace_rate_limited`） |

实现：`app/api/miniapp/**/route.ts`，公共校验在 `lib/miniapp/request.ts`，限流在 `lib/miniapp/rate-limit.ts`（进程内存，单实例；多实例前需换成 Redis）。四个数据库函数原样保留在 `db/schema.sql`，接口只是 `select * from fn(...)` 的薄封装。

## 媒体

数据库里的 `file_url` 已经是 OSS 地址；音频素材仍遵循「同目录同名、扩展名换成 `.m4a`」的约定（`assets/audio.js`），新上传的 `.webm` 需运行 `scripts/transcode-webm-to-m4a.ts`。
