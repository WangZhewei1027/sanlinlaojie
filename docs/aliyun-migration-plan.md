# 阿里云自托管迁移计划：脱离 Vercel 与 Supabase

> 状态：**路线 B 已实施**（2026-10-01，分支 `claude/aliyun-migration`）。代码层全部完成并通过构建；基础设施已就绪；数据迁移脚本已写好，等待 Supabase 数据库连接串后执行；小程序按用户要求本次不动。执行记录见第 0 节，原分析保留在后文供对照。

## 0. 执行记录（2026-10-01）

| 项 | 结果 |
|---|---|
| 代码 | supabase-js 全部移除：数据层 Kysely（`lib/db`，基线 `db/schema.sql`），认证 Better Auth（`lib/auth`，`auth` schema，bcrypt 哈希原样导入），存储 OSS（`lib/storage`，上传经 `/api/upload` 中转）。约定见 `docs/data-layer.md` |
| 服务器 | 现有轻量服务器 `Ubuntu-gfoj`（上海，2C/2G）：加 2G swap、装 Docker 29.8.1，`/opt/sanlin` 跑 Caddy + Next standalone + PostGIS（`deploy/`）。镜像在本机构建后经 SSH 装载（服务器不能访问 Docker Hub） |
| OSS | 桶 `sanlinlaojie-media`（public-read，须关闭"阻止公共访问"；CORS 允许 GET/HEAD）：`assets/`、`wechat-qrcodes/`（1,122 个对象已全量复制）、`static/cesium/1.111/`、`static/draco/gltf/`、`tiles/terra_b3dms/`。备份桶 `sanlinlaojie-backups`（私有，30 天过期） |
| 凭证 | 新建 RAM 用户 `sanlin-app`（仅该桶 + 号码认证服务），替换掉原先放在 `.env.local` 里的主账号 AccessKey |
| CI/CD | `.github/workflows/deploy.yml`：push main → 构建镜像 → SSH 部署；密钥 `DEPLOY_SSH_KEY` 与变量已配置 |
| 数据 | 2026-10-01 已从 Supabase 导入线上库（152 用户 / 2,031 素材，逐表核对一致），媒体 URL 已改到 OSS，夜间备份已验证 |
| 切换 | 2026-10-01 DNS 已指向服务器，站点 `https://spatialmemory.online`（www 跳转到主域名），Caddy 自动签证书；Vercel 项目可删除 |
| 待办 | ① 绑定 `media.spatialmemory.online`（可选 CDN）后用 `rewrite-urls.sh` 换 URL 前缀并改 `NEXT_PUBLIC_MEDIA_BASE_URL`；② 配 SMTP（邮件确认/找回）与天地图 key；③ 小程序改调 `/api/miniapp/*`（第 5 节），之后才能关 Supabase |

目标：把整个后端改为自己部署的 Docker 服务，运行在阿里云上，不再依赖 Vercel 托管，也不再使用 Supabase 的任何组件；媒体文件迁到阿里云 OSS + CDN。

---

## 1. 先看这几点

1. **媒体实际存在 Supabase Storage，不在 Cloudinary。** 浏览器用 supabase-js 直传到两个公开桶 `assets`、`wechat-qrcodes`（`lib/upload/service.ts`）。Cloudinary 只剩离线脚本 `scripts/transcode-webm-to-m4a.ts`。全仓库没有 URL 图像变换参数，换成普通 OSS 不会让显示出错。README 与 CLAUDE.md 中「媒体存 Cloudinary / 转 WebP」的描述已过时。
2. **小程序的后端访问很集中。** 数据读写全部经过一个文件 `miniprogram/utils/supabase.ts` 的两个函数（约 10 处调用），识别另走 `matching/config.js` 里配置的 Edge Function。改造范围明确，见第 5 节。
3. **公开的 anon key + 未开 RLS。** anon key 写死在 `miniprogram/utils/supabase.ts`，而小程序仓库是公开的；据 `docs/saas-role-refactor.md`，核心表未开 RLS。两者叠加，任何人都可能直接通过 Supabase REST 读写核心表（线上实际授权未核实，可在 Supabase 控制台的 Security Advisor 查看）。路线 B 的第一步正好堵上这个口子。
4. **仓库里没有完整的数据库结构。** `supabase/migrations/` 的 17 个迁移只是增量修改；基础表、`auth.users` 上的注册触发器 `handle_new_user`、小程序用的 4 个函数（`get_nearby_assets`、`get_huge_assets`、`get_shop_assets`、`upload_text_asset`）、存储桶及权限策略都只存在于线上库。第一步必须从线上库导出完整结构。

---

## 2. 依赖盘点

| 依赖 | 现在怎么用 | 路线 B 下的处理 |
|---|---|---|
| **Vercel** | 只托管 Next。无 `vercel.json`、无 `@vercel/*` 包、无 cron。仅 `app/layout.tsx` 读取 `VERCEL_URL`；4 个路由声明 `maxDuration = 60`（Node 下无效） | 容器化 |
| **Supabase Auth（GoTrue）** | 邮箱密码登录、邮件确认与找回；手机号用户以虚拟邮箱 `<手机号>@phone.sanlinlaojie.local` 存在 Auth 中；服务端约 46 处 `auth.getUser()`，客户端约 19 处；admin API：createUser / deleteUser / listUsers / updateUserById | 换成自有认证（第 7.2 节） |
| **PostgREST（supabase-js 查询）** | 服务端约 115 处 `.from()`（约 38 个文件）、10 处 `.rpc()`；小程序约 10 处直连 | 改为直接写 SQL；小程序改调接口 |
| **Postgres + PostGIS** | 15 个自定义函数、2 个 asset 触发器、`auth.users` 触发器；授权语句使用 `anon` / `authenticated` / `service_role`；`extensions` schema 放 PostGIS | 保留函数与 PostGIS；去掉 Supabase 专用角色与 `auth` 依赖 |
| **Supabase Storage** | 两个公开桶；数据库存完整公开 URL；浏览器直传与清理；服务端删除与全桶扫描 | OSS + CDN（第 6 节） |
| **Edge Function** | `recognize-anchor`（Deno），小程序当前通过它识别，固定 `x-region: ap-south-1` | 合并回 Next 路由（D5） |
| **Realtime / pg_cron / Vault / pgvector** | 均未使用 | 无 |
| **Cloudinary** | 仅离线转码脚本 | ffmpeg worker |
| **阿里云短信 / PAI-EAS** | 已在阿里云 | 保留；服务器与 EAS 同地域 |
| **微信接口** | 生成小程序码；access_token 缓存在进程内存（`app/manage/actions/wechat-qr.ts`） | 多实例时需共享缓存 |
| **境外 CDN / 服务** | Cesium 从 cesium.com 加载，默认 Ion（Bing）影像；drei 的 Draco 解码器来自 gstatic；`next/font/google` 构建时下载字体；小程序树模型来自 8thwall.app | 自托管或替换 |

---

## 3. 目标架构

```
                    ┌──────────── 阿里云 ECS（docker compose）────────────┐
 浏览器 / 小程序 ──► │ nginx (TLS)                                          │
                    │   app.<域名>、api.<域名> → next（standalone）         │
                    │ worker（ffmpeg 音频转码）                             │
                    └───────────────┬──────────────────────────────────────┘
                                    │ VPC 内网
            PostgreSQL + PostGIS（RDS 或自建）    OSS（私有 bucket）◄── CDN media.<域名>
                                    │
                         PAI-EAS（SAGE 模型，尽量同地域）
```

只有 Next 与 Postgres 两个有状态服务依赖；认证、数据访问、小程序接口、识别都在 Next 里。

---

## 4. 决策

| # | 决策 | 选项 | 建议 | 决定 |
|---|---|---|---|---|
| D1 | 地域与备案 | 内地（如华东 2 上海）并办 ICP 备案；或香港（免备案） | **上海 + 立即启动备案**。内地 CDN 加速需要备案，按微信规则小程序合法域名也要求备案。备案通常需要 1–3 周，是关键路径。已有域名 `spatialmemory.online`（网页在用），需确认它是否已备案、`.online` 后缀能否备案。确认 EAS 地域，服务器放同地域 | **上海**；域名已备案 |
| D2 | 脱离 Supabase 到什么程度 | A 自托管 Supabase 组件；B 完全去掉 Supabase | — | **B** |
| D3 | 数据库托管 | 阿里云 RDS PostgreSQL；或 ECS 上 Docker 自建（`postgis/postgis` 镜像） | 路线 B 只需要普通 PostgreSQL + PostGIS，两者都没有兼容问题，只是运维取舍。**建议 RDS**，省掉备份与高可用；若自建，必须定时 `pg_dump` 到 OSS 并演练恢复 | **ECS 上 Docker 自建**，每晚 pg_dump 到私有 OSS 桶；要换 RDS 只改连接串 |
| D4 | 小程序接入方式 | — | 随 B 确定：改调 `/api/miniapp/*`，不再直连数据库 | **改调接口** |
| D5 | 识别服务 | 合并回 Next 路由；保留 Deno 容器 | **合并回 Next**：`/api/miniapp/anchors/recognize` 已存在，把 Edge 版的两次 SQL 往返逻辑移植过去。自托管后 Next 与数据库、EAS 同地域，Edge 的延迟优势不再存在，也少维护一种运行时 | 网页端路由已迁；小程序仍走 Edge Function（本次不动） |
| D6 | 部署形态 | 单台 ECS + docker compose；SAE / ACK | **先单台**。进程内状态（`revalidatePath` 缓存、微信 access_token）在多实例下需要 Redis | **单台 + docker compose** |
| D7 | 认证库 | Better Auth；Auth.js；自写 | 需要：邮箱密码、邮件确认与找回、会话存 Postgres、可自定义密码校验（导入旧 bcrypt 哈希）、服务端创建会话（接入现有阿里云短信流程）。**Better Auth 满足这些**，选型前需做一次小原型验证 | **Better Auth 1.7**（已验证旧 bcrypt 哈希、手机号流程） |
| D8 | 最终域名 | 例如 `api.<域名>`、`media.<域名>` | **现在就定下来**，小程序一次改到最终域名，过渡期靠 DNS 指向现有服务，之后切换无需再发版 | 网页 `spatialmemory.online`（同源 API），媒体 `media.spatialmemory.online`（切换前用桶原始域名） |
| D9 | OSS / CDN 细项 | 见 6.3 | | 桶 public-read（与原 Supabase 公开桶一致），上传经 Next 中转而非浏览器直传；CDN 待开通 |

---

## 5. 小程序改造（`xr-frame-plant-trees`）

### 5.1 现在的后端访问

| # | 调用 | 位置 | 类型 |
|---|---|---|---|
| 1 | `organization` 表：`name,config` / `id,name`（按 id 列表） / `config` | `pages/index/index.ts`（2 处）、`components/xr-start/index.js` | 读 |
| 2 | `workspace` 表：`name` / `id,name`（按 id 列表） | `pages/index/index.ts`（2 处） | 读 |
| 3 | RPC `get_nearby_assets(user_lat, user_lng, max_distance_meters, p_workspace_id, p_organization_id)` | `components/xr-start/assets/index.js` | 读 |
| 4 | RPC `get_huge_assets(p_organization_id, p_workspace_id)` | `components/xr-start/assets/huge.js` | 读 |
| 5 | RPC `get_shop_assets(p_workspace_id, p_organization_id)` | `components/shop-checkin/index.js` | 读 |
| 6 | RPC `upload_text_asset(user_lat, user_lng, p_workspace_id, p_organization_id, content)` | `pages/upload/upload.ts`、`pages/ar/ar.ts`（弹幕） | **匿名写** |
| 7 | Edge Function `/functions/v1/recognize-anchor`（`wx.uploadFile`，带 `x-region`） | `components/xr-start/matching/config.js`、`index.js` | 识别 |
| 8 | 媒体 `file_url`：xr-frame `loadAsset`、音频 `wx.downloadFile` | `components/xr-start/assets/*.js` | 下载 |

第三方资源：树模型 `8thwall.8thwall.app/.../tree-*.glb`（`components/xr-start/config.js`）、平面标记模型（微信官方 demo 的腾讯云 COS，`components/xr-start/index.wxml`）。

### 5.2 新接口

原则：**请求参数与响应结构与现有 RPC / 查询完全一致**，小程序只需把 `supabaseGet` / `supabaseRpc` 换成调用新接口的函数，渲染代码不动。4 个 RPC 保留为数据库函数，接口只是用 SQL 调用它们的薄封装。

| 新接口 | 替代 | 说明 |
|---|---|---|
| `GET /api/miniapp/organizations?ids=` | 1 | 返回 `[{id, name, config}]`；`config` 只放行小程序用到的键（`confetti_enabled`、`shop_checkin_enabled`、`footer_enabled`、`text_asset_miniapp_style`） |
| `GET /api/miniapp/workspaces?ids=` | 2 | 返回 `[{id, name}]` |
| `POST /api/miniapp/assets/nearby` | 3 | 请求体同 RPC 参数 |
| `POST /api/miniapp/assets/huge` | 4 | 同上 |
| `POST /api/miniapp/shops` | 5 | 同上 |
| `POST /api/miniapp/text-assets` | 6 | **新增限流与内容长度限制**（现在任何人拿 anon key 都能往任意空间写入） |
| `POST /api/miniapp/anchors/recognize` | 7 | 路由已存在，移植 Edge 版逻辑（D5） |

### 5.3 注意事项

- **识别负载**：最新提交把识别改为每秒 1 次、最多 6 个并发请求（`matching/config.js`）。数据库里的工作空间限流是每分钟 120 次，约 2 个用户同时识别就会触发 429。自托管时需要一起重新设计限流与服务器容量（每个识别请求都会调一次 EAS）。
- **旧版本**：发版后用户手机上的旧版本仍会访问 supabase.co 一段时间。在旧版本流量归零之前，Supabase 与 anon 权限都要保留。建议本次发版加入 `wx.getUpdateManager()` 强制更新（当前代码没有），以后切换能更快完成。
- **合法域名**：request / uploadFile 加 `api.<域名>`，downloadFile 加 `media.<域名>`。树模型和标记模型建议一并搬到自己的 OSS，避免依赖第三方托管。
- **音频约定**：`assets/audio.js` 遇到 `.webm` 会自动改请求同路径的 `.m4a`。转码 worker 必须保持「同目录同名、扩展名换成 `.m4a`」的约定。

---

## 6. OSS / CDN 迁移方案

### 6.1 现状

- `assets` 桶：公开，单文件上限 5 MiB，路径 `{userId}/{时间戳}-{随机}.{ext}`；各类型限制见 `lib/upload/config.ts`。
- `wechat-qrcodes` 桶：公开，路径 `release/{orgId}__{wsId|none}.png`，上传时设置一年缓存。
- 数据库存**完整公开 URL**（`https://<ref>.supabase.co/storage/v1/object/public/...`），共三处：`asset.file_url`、`asset.metadata->>'checkin_url'`、`anchor_embedding.image_url`。去重（`content_hash`）、引用计数（`lib/storage-cleanup.server.ts`）、特征一致性检查都依赖这些字符串**完全相等**。
- 存储权限策略（`storage.objects` 上的 RLS）只在 Supabase 控制台，不在仓库。
- 另有 **2.6 GB、10,637 个文件的 Cesium 3D 瓦片**在 `public/js/viewer/terra_b3dms`，直接提交在 git 里（`.git` 约 1.9 GB），由 Next 当静态文件提供；中间件匹配规则没有排除 `.b3dm` / `.json`，每个瓦片请求都要过登录检查。

### 6.2 目标布局

- 一个**私有** bucket，按前缀划分：`assets/`、`wechat-qrcodes/`、`tiles/terra_b3dms/`、`static/`（Cesium 库、小程序用的第三方模型）。**保留原有对象路径**，URL 改写只需替换前缀。
- CDN 加速域名 `media.<域名>`，开启「阿里云 OSS 私有 Bucket 回源」，外部只能经 CDN 访问；HTTPS 证书用阿里云证书服务。
- 缓存：`assets/*` 文件名唯一 → 1 年 `immutable`；`wechat-qrcodes/*` 长缓存（重建时刷新 CDN）；`tiles/**/*.b3dm` 长缓存，`tileset.json` 较短。
- 上传时显式设置 `Content-Type` 与 `Cache-Control`（以前由 Supabase 隐式处理）。

### 6.3 子决策

| | 选项 | 建议 |
|---|---|---|
| 数据库存什么 | 继续存完整 URL；或只存对象 key | **继续存完整 URL，但换成自己的域名**。以后换厂商只改 DNS / 回源，不用再改库 |
| 上传方式 | 浏览器直传 OSS（服务端签名）；经 Next 中转 | **直传，服务端签发 PostObject V4 策略**：限定 key 前缀 `assets/{userId}/`、`content-length-range` ≤ 5 MiB、Content-Type。浏览器端删除（`cleanupUploadedFile`）改为调服务端接口 |
| 防盗链 | Referer 白名单；不开 | 白名单：web 域名 + `servicewechat.com`（小程序请求来源）。**先小范围测试再开**，小程序音频下载可能不带 Referer |
| 3D 瓦片 | 上 OSS+CDN（变为公开可访问）；或保留在需登录的源站 | 能接受公开就上 CDN，从 git 和镜像中移除。是否用 `git filter-repo` 清理历史另行决定（会改写历史，所有人需重新 clone） |
| 音频转码 | worker 容器跑 ffmpeg；阿里云 IMS + OSS 事件触发 | **ffmpeg worker**，上传登记后自动生成同名 `.m4a` |
| 地图底图 | 现为 cesium.com 加载 + Ion 默认 Bing 影像，内地基本不可用，手机端只有这一层 | **Cesium 自托管到 CDN，底图换天地图**（WGS84，与 GPS 一致；高德为 GCJ-02 会偏移几百米） |

### 6.4 代码改动

新建 `lib/storage/`（OSS 适配器：签名上传、删除、列举、HEAD、公开 URL），配置 `MEDIA_BASE_URL`、`OSS_BUCKET`、`OSS_REGION`；服务器用 ECS 的 RAM 角色授权，不在环境变量里放 AccessKey。

| 文件 | 改动 |
|---|---|
| `lib/upload/service.ts` | 改为先取签名再直传 OSS；显式 Content-Type / Cache-Control；失败清理改调服务端 |
| `lib/storage-cleanup.server.ts` | 路径正则写死了 Supabase 格式，**换 OSS 后删除会静默跳过**，必须改 |
| `app/api/admin/clean/route.ts` | 全桶扫描改用 ListObjectsV2（continuation token、LastModified）+ HeadObject |
| `lib/user-deletion.server.ts` | 批量删除改用 OSS DeleteMultipleObjects |
| `app/manage/actions/wechat-qr.ts`、`lib/wechat-qr.ts` | 上传与 URL 构造改用 OSS / CDN |
| `lib/anchor/reference.server.ts` | 防 SSRF 白名单写死 `NEXT_PUBLIC_SUPABASE_URL` + 存储路径，改为 `MEDIA_BASE_URL`；服务端取参考图可走 OSS 内网地址。注意它用 `redirect: "error"`，CDN 不能返回跳转 |
| `scripts/test-anchor-matching.cjs` | 同步更新白名单测试 |
| `public/js/viewer/`（`index.html`、`src/utils/config.js`） | Cesium 与瓦片地址改为 CDN；底图改天地图 |
| `proxy.ts` | 瓦片移走后无需再匹配；若保留在源站，至少排除静态瓦片路径 |

### 6.5 数据迁移步骤

1. **盘点**：统计两个桶的对象数与总量（本次未能核查）。
2. **全量复制**：用 rclone（Supabase Storage 支持 S3 协议）复制到 OSS，对象路径不变，保留 Content-Type；复制完核对数量与大小。
3. **维护窗口**：暂停上传 → 增量复制 → 在**同一事务**改写数据库 URL → 上线新代码。

   ```sql
   -- :old = 'https://mkdfezaufjhrfjkfqlbj.supabase.co/storage/v1/object/public/'
   -- :new = 'https://media.<域名>/'（后面保留 assets/... 或 wechat-qrcodes/...）
   begin;
   alter table public.asset disable trigger invalidate_anchor_embedding;  -- 必须！
   update public.asset
     set file_url = replace(file_url, :old, :new)
     where file_url like :old || '%';
   update public.asset
     set metadata = jsonb_set(metadata, '{checkin_url}',
       to_jsonb(replace(metadata->>'checkin_url', :old, :new)))
     where metadata->>'checkin_url' like :old || '%';
   update public.anchor_embedding
     set image_url = replace(image_url, :old, :new)
     where image_url like :old || '%';
   alter table public.asset enable trigger invalidate_anchor_embedding;
   commit;
   ```

   **禁用触发器那一行不能省**：`invalidate_anchor_embedding`（迁移 `20260908000000_anchor_matching.sql`）在 `file_url` 变化时会删除匹配点特征，不禁用会让所有匹配点失效，识别一律返回 `reference_not_ready`。三列必须用同一规则改写，否则去重、引用计数和特征一致性检查都会出错。
4. **小程序**：提前把 `media.<域名>` 加进 downloadFile 合法域名。
5. **收尾**：Supabase 桶保留只读至少 2 周（旧版小程序、外部分享链接），之后删除。

### 6.6 CORS

需要 `Access-Control-Allow-Origin`（在 OSS bucket 与 CDN 响应头同时配置）：地图中的图片 billboard（`crossOrigin = "anonymous"` 后画到 canvas，缺 CORS 直接失败）、3D 模型预览（drei `useGLTF`）、Cesium 瓦片与自身资源、Draco 解码器，以及浏览器直传（允许 POST，暴露 `ETag`）。`<img>` / `<video>` / `<audio>` 与 `new Audio(url)` 不需要 CORS。

---

## 7. 数据层与认证（路线 B）

### 7.1 数据层

- 用 Drizzle 或 Kysely + `pg` 直接写 SQL，替换约 115 处 `.from()` 与 10 处 `.rpc()`。过渡期连的仍是 Supabase 的库：在 Vercel 上要用 Supabase 的连接池地址（事务模式需关闭 prepared statement）。
- 需要翻译的 PostgREST 用法：嵌套 select 联表、`.or(ilike)`、`asset.workspace_id`（`uuid[]`）上的 `contains` / `overlaps`、`count: "exact", head: true`、`upsert` + `onConflict`、以 `POINT(lng lat)` 字符串写入的位置。`lib/supabase/paginate.ts`（绕开 1000 行上限）可以删除。
- 现有数据库函数（`move_assets`、匹配相关、小程序的 4 个函数等）保留，用 `select ... from fn(...)` 调用。
- 权限判断本来就在应用层（`lib/permissions.server.ts`），路线 B 与现有设计一致。唯一依赖 RLS 的是 `user_organization_pin`（3 条 `auth.uid()` 策略），改为在 `app/api/organizations/pin/route.ts` 里显式校验。
- 客户端两处直连（`components/user-avatar-menu.tsx` 读 `users`、上传服务里的引用计数查询）改走接口。
- 新的基线迁移去掉对 `anon` / `authenticated` / `service_role` 的授权语句；应用使用一个专用数据库角色连接。

### 7.2 认证

- **用户 id 保持不变**：新认证库的用户表沿用 `auth.users` 的 UUID，`public.users.user_id` 等所有归属数据无需改动。
- **密码**：从 `auth.users.encrypted_password` 导入 bcrypt 哈希，自定义校验函数兼容旧哈希，登录成功后可重新哈希。用户密码不变，但所有人需要重新登录一次。
- **手机号**：保留现有阿里云短信校验与验证凭证（`lib/auth/sms.ts`、`lib/auth/sms-ticket.server.ts`，签名密钥改为独立的环境变量），校验通过后用认证库的服务端 API 创建会话。虚拟邮箱方案可以保留，也可以借机改为独立的手机号字段。
- **邮件**：确认邮件与找回密码改用阿里云邮件推送（SMTP）；模板从 Supabase 控制台复制。
- **注册初始化**：`auth.users` 上的 `handle_new_user` 触发器（建 `users` 行、个人组织、owner 成员、默认工作空间）改到注册流程的应用代码里，或挂到新用户表上。
- **替换点**：服务端约 46 处 `auth.getUser()`、客户端约 19 处（`getUser` / `onAuthStateChange` / `signOut`）、`proxy.ts` + `lib/supabase/proxy.ts` 的会话刷新与登录跳转、`/auth/confirm` 路由、用户管理的 admin 调用（`app/api/users/*`、`scripts/batch-register-users.ts`）。
- `app/api/users/route.ts` 读取的 `last_sign_in_at` 需要由新认证库记录。

---

## 8. Next 应用容器化

- `next.config.ts` 增加 `output: "standalone"`；运行时设 `HOSTNAME=0.0.0.0`。
- `NEXT_PUBLIC_*` 在构建时写入客户端代码，需作为 Docker build args 传入。
- 固定版本：`next`（`package.json` 写 `latest`，锁文件解析为 16.x，不是 CLAUDE.md 写的 15）。supabase 的两个包在迁移完成后移除。
- `app/layout.tsx` 的 `VERCEL_URL` 改为站点域名变量（如 `NEXT_PUBLIC_SITE_URL`）。
- `lib/fonts.ts` 的 `next/font/google` 改为 `next/font/local`，否则在内地构建会卡在下载字体。
- 基础镜像用 glibc（Debian slim），或确保 Alpine 下安装 musl 版 sharp。
- 反向代理需转发 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`：邀请链接由 `new URL(request.url).origin` 生成（`app/api/organizations/[id]/invitations/route.ts`）。
- 镜像不要打进 `public/js/viewer/terra_b3dms`（2.6 GB），瓦片走 CDN。
- 镜像推到阿里云容器镜像服务（ACR）；CI 可沿用 GitHub Actions 构建推送，服务器拉取部署。
- 删除只在 Vercel 生效的 `export const maxDuration`，以及模板遗留组件 `components/deploy-button.tsx`。

---

## 9. 分阶段计划

按依赖顺序排列。第 1–4 阶段都可以在仍使用 Supabase 云与 Vercel 时完成，每一步可单独上线、单独回退；最后的基础设施切换只剩换连接串和 DNS。

### 阶段 0：准备（现在即可开始，互不阻塞）

- [ ] 启动 ICP 备案，定下最终域名（D1、D8）
- [ ] 确认 EAS 所在地域
- [ ] 从线上库导出完整结构（含小程序用的 4 个函数与 `handle_new_user` 触发器）并提交进仓库
- [ ] 在 Supabase Security Advisor 确认 anon 角色的实际权限
- [ ] 固定 `next` 版本；Dockerfile（standalone）+ docker compose；替换 `VERCEL_URL`；改用本地字体

### 阶段 1：小程序改调接口（顺带堵上 anon key 的口子）

- [ ] Next 新增 `/api/miniapp/*`（第 5.2 节），识别路由移植 Edge 版逻辑
- [ ] 小程序改用新接口与最终域名，加入强制更新，发版
- [ ] 旧版本流量归零后，收回 anon 角色的全部表与函数权限

### 阶段 2：数据层改为直接写 SQL

- [ ] 引入 Drizzle / Kysely，逐个路由替换 supabase-js 查询（连接 Supabase 连接池）
- [ ] 去掉对 RLS 与 `auth.uid()` 的依赖

### 阶段 3：换掉认证

- [ ] 认证库原型验证（D7）：旧 bcrypt 哈希登录、手机号流程、邮件
- [ ] 导入用户、上线；所有用户重新登录一次
- [ ] 注册初始化逻辑移出 `auth.users` 触发器

### 阶段 4：存储迁到 OSS + CDN

- [ ] 按第 6 节执行（与阶段 2、3 互不依赖，可并行）

### 阶段 5：基础设施切换

- [ ] Next 部署到 ECS Docker，DNS 切换，下线 Vercel
- [ ] 维护窗口内 `pg_dump` 业务 schema 导入 RDS / 自建库，切换连接串
- [ ] 关闭 Supabase 项目；清理 `.mcp.json`、`.codex/config.toml`、`.vscode/mcp.json` 中的 Supabase 配置；更新文档（第 12 节）

---

## 10. 安全问题

| 问题 | 状态 |
|---|---|
| `resetPasswordByPhone` / `createUserByPhone` 服务端不校验短信验证码，可重置任意手机号用户的密码 | **已修复**（PR #3） |
| `resetPasswordByPhone` 中 `listUsers()` 未分页，超过约 50 个用户后手机号重置失败 | **已修复**（PR #3） |
| 核心表未开 RLS，anon key 公开在小程序公开仓库与网页中，可能可以直接读写核心表（线上授权未核实） | 未处理；阶段 1 收回 anon 权限 |
| `upload_text_asset` 允许匿名向任意工作空间写入，无限流 | 未处理；阶段 1 的新接口加限流 |
| 生成小程序码的 server action 无鉴权，微信接口额度可被滥用 | 未处理 |
| `POST /api/assets/[id]/matching` 公开，任何人可触发付费 EAS 计算 | 未处理 |

---

## 11. 待确认的信息

- 两个存储桶的对象数量与总大小
- 线上库完整结构、`storage.objects` 权限策略、anon 角色的实际授权
- EAS 部署地域
- `spatialmemory.online` 的备案情况
- Supabase 控制台中的 SMTP、邮件模板、Site URL 与重定向配置
- 小程序各版本的使用占比（决定何时收回 anon 权限、关闭 Supabase）

---

## 12. 迁移完成后需同步更新的文档

- `CLAUDE.md`：Supabase 客户端与权限说明、上传去向（Cloudinary → OSS）、Next 版本、路由表中不存在的 `/admin/clean`
- `README.md`：媒体存储、WebP 说法、`.env.example`（文件不存在）
- `docs/asset-pipeline.md`、`docs/asset-storage-lifecycle.md`：存储 URL 格式与删除流程
- `docs/anchor-matching.md`、`docs/edge-anchor-recognition.md`：识别部署方式
- `docs/permissions.md`、`docs/saas-role-refactor.md`：认证与 RLS 相关描述
- `docs/wechat-qr-code.md`、`docs/audio-compatibility.md`、`docs/3d-model-preview.md`
- 小程序仓库：`miniprogram/utils/supabase.ts` 改名，`docs/anchor-recognition.md` 更新接口地址
