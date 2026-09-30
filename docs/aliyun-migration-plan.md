# 阿里云自托管迁移计划：脱离 Vercel 与 Supabase

> 状态：**草案，待决策**（2026-09-30）。本文基于对仓库代码与 docs 的盘点，线上 Supabase 库、存储桶、小程序代码均未能直接核查，相关结论已标注。决策结果请直接填入第 4 节「决定」列。

目标：把整个后端改为自己部署的 Docker 服务，运行在阿里云上，不再依赖 Vercel 托管和 Supabase 云服务；媒体文件迁到阿里云 OSS + CDN。

---

## 1. 先看这三点

1. **媒体实际存在 Supabase Storage，不在 Cloudinary。** 浏览器用 supabase-js 直传到两个公开桶 `assets`、`wechat-qrcodes`（`lib/upload/service.ts`）。Cloudinary 只剩离线脚本 `scripts/transcode-webm-to-m4a.ts`（WebM 音频转 m4a）。全仓库没有任何 URL 图像变换参数，换成普通 OSS 不会让显示出错。README 与 CLAUDE.md 中「媒体存 Cloudinary / 转 WebP」的描述已过时。
2. **小程序是最大的外部耦合。** 据文档，小程序用 anon key 直连 Supabase REST（`organization`、`danmaku` 表，`get_nearby_assets` RPC，见 `.github/instructions/org-config.instructions.md`、`docs/anchor-matching.md`），识别走 Edge Function `recognize-anchor`，媒体直接从 supabase.co 下载。无论选哪条路线，小程序都要改代码并发版，而它的代码不在本仓库。
3. **仓库里没有完整的数据库结构。** `supabase/migrations/` 的 17 个迁移只是在已有表上增量修改；基础表、`auth.users` 上的注册触发器 `handle_new_user`、`get_nearby_assets`、存储桶及其权限策略只存在于线上库，且远端迁移历史与本地不一致（见 `docs/edge-anchor-recognition.md`）。第一步必须从线上库导出完整结构。

---

## 2. 依赖盘点

| 依赖 | 现在怎么用 | 迁移影响 |
|---|---|---|
| **Vercel** | 只是托管 Next。无 `vercel.json`、无 `@vercel/*` 包、无 cron、无 edge runtime。仅 `app/layout.tsx` 读取 `VERCEL_URL`，4 个路由声明 `maxDuration = 60`（Node 下无效，可删） | 小：容器化即可 |
| **Supabase Auth（GoTrue）** | 邮箱密码登录、邮件确认与找回（`/auth/confirm` 的 token_hash 流程）；手机号用户以虚拟邮箱 `<手机号>@phone.sanlinlaojie.local` 存在 Auth 中（`lib/phone-email.ts`、`lib/auth/sms.ts`）；服务端约 46 处 `auth.getUser()`，客户端约 19 处；admin API：createUser / deleteUser / listUsers / updateUserById | **大**：见第 6 节 |
| **Postgres + PostGIS** | 15 个自定义函数（含 `move_assets`、匹配相关 RPC）、2 个 asset 触发器、`auth.users` 触发器；授权语句大量使用 `anon` / `authenticated` / `service_role` 角色；`extensions` schema 放 PostGIS | 中：需要兼容角色或改写 |
| **PostgREST** | 服务端约 115 处 `.from()`、10 处 `.rpc()`；用到嵌套 select 联表、`.or(ilike)`、数组 `contains/overlaps`、`count: exact`、upsert、1000 行上限（`lib/supabase/paginate.ts`）；小程序直连 | 路线 A 保留，路线 B 需全部改写 |
| **Supabase Storage** | `assets`、`wechat-qrcodes` 两个公开桶；数据库存完整公开 URL；浏览器直传、浏览器端清理失败上传；服务端删除、全桶扫描清理 | **大**：见第 5 节 |
| **Edge Function** | `supabase/functions/recognize-anchor`（Deno），小程序直接调用，固定 `x-region: ap-south-1` | 中：自己跑成 Deno 容器 |
| **Realtime / pg_cron / Vault / pgvector** | 均未使用 | 无 |
| **Cloudinary** | 仅离线转码脚本 | 小：换 ffmpeg |
| **阿里云短信 / PAI-EAS** | 已在阿里云 | 无，但服务器应与 EAS 同地域 |
| **微信接口** | 生成小程序码；access_token 缓存在进程内存（`app/manage/actions/wechat-qr.ts`） | 多实例时需共享缓存 |
| **境外 CDN / 服务** | Cesium 从 cesium.com 加载，默认 Ion（Bing）影像；drei 的 Draco 解码器来自 gstatic；`next/font/google` 构建时下载字体 | 内地访问或构建会慢甚至失败 |

---

## 3. 目标架构（路线 A）

```
                    ┌──────────────── 阿里云 ECS（docker compose）────────────────┐
 浏览器 / 小程序 ──► │ nginx (TLS)                                                  │
  app.<域名>        │   /               → next (standalone)                        │
  api.<域名>        │   /auth/v1/       → gotrue                                   │
                    │   /rest/v1/       → postgrest（收紧 anon 权限）              │
                    │   /functions/v1/recognize-anchor → deno（原 Edge Function） │
                    │ worker（ffmpeg 音频转码）                                    │
                    └───────────────┬──────────────────────────────────────────────┘
                                    │ VPC 内网
                  RDS PostgreSQL + PostGIS        OSS（私有 bucket）◄── CDN media.<域名>
                                    │
                         PAI-EAS（SAGE 模型，尽量同地域）
```

nginx 按 Supabase 的路径布局转发，supabase-js 与小程序只需换域名和密钥。`/storage/v1` 不再提供，存储全部改走 OSS。

---

## 4. 待决策事项

| # | 决策 | 选项 | 建议 | 决定 |
|---|---|---|---|---|
| D1 | 地域与备案 | 内地（如华东 2 上海）并办 ICP 备案；或香港（免备案） | **上海 + 立即启动备案**。内地 CDN 加速需要备案，按微信规则小程序合法域名也要求备案（现在 supabase.co 是怎么配进去的需确认）。备案通常需要 1–3 周，是关键路径。确认 EAS 地域，服务器放同地域：现在一次识别约 2.9 秒，其中约 1.9 秒是 Edge 到 EAS 的往返 | 待定 |
| D2 | 脱离 Supabase 到什么程度（**最关键**） | **A** 自托管 Supabase 开源组件（GoTrue + PostgREST），存储单独换 OSS；**B** 完全去掉 Supabase：自写认证（如 Better Auth，导入 bcrypt 哈希）、约 115 处查询改 SQL（Drizzle / Kysely）、约 65 处认证调用重写、小程序只调 Next 接口 | **先 A 后按需渐进到 B**。A 的改动集中在存储层与环境变量，用户密码原样保留；代价是多维护两个服务 | 待定 |
| D3 | 数据库托管 | 阿里云 RDS PostgreSQL（支持 PostGIS）；或 ECS 上 Docker 自建 | **RDS**，数据库是唯一不能丢的状态。需先验证 GoTrue 自带迁移在 RDS 非超级用户权限下能否跑通。若自建，必须做定时 `pg_dump` 到 OSS 并演练恢复 | 待定 |
| D4 | 小程序接入方式 | 只换域名继续直连 REST；或改调 `/api/miniapp/*` | 反正要发版，**写操作（弹幕、上传）改走接口**；继续开放 REST 则把 anon 角色收紧到必要的只读表和函数 | 待定 |
| D5 | 识别服务 | Deno 函数单独跑容器；或合并回 Next 路由 | **Deno 容器，路径保持 `/functions/v1/recognize-anchor`**，小程序只换域名，现有 `scripts/test-edge-*.cjs` 继续有效 | 待定 |
| D6 | 部署形态 | 单台 ECS + docker compose；SAE / ACK | **先单台**。进程内状态（`revalidatePath` 缓存、微信 access_token）在多实例下需要 Redis | 待定 |
| D7 | 切换方式 | 分阶段；一次停机全切 | **分阶段**，见第 9 节 | 待定 |
| D8 | OSS / CDN 细项 | 见 5.3 | | 待定 |

---

## 5. OSS / CDN 迁移方案

### 5.1 现状

- `assets` 桶：公开，单文件上限 5 MiB，路径 `{userId}/{时间戳}-{随机}.{ext}`；各类型限制见 `lib/upload/config.ts`。
- `wechat-qrcodes` 桶：公开，路径 `release/{orgId}__{wsId|none}.png`，上传时设置一年缓存。
- 数据库存**完整公开 URL**（`https://<ref>.supabase.co/storage/v1/object/public/...`），共三处：`asset.file_url`、`asset.metadata->>'checkin_url'`、`anchor_embedding.image_url`。去重（`content_hash`）、引用计数（`lib/storage-cleanup.server.ts`）、特征一致性检查都依赖这些字符串**完全相等**。
- 存储权限策略（`storage.objects` 上的 RLS）只在 Supabase 控制台，不在仓库。
- 另有 **2.6 GB、10,637 个文件的 Cesium 3D 瓦片**在 `public/js/viewer/terra_b3dms`，直接提交在 git 里（`.git` 约 1.9 GB），由 Next 当静态文件提供，并且因为中间件匹配规则没有排除 `.b3dm` / `.json`，每个瓦片请求都要过登录检查。

### 5.2 目标布局

- 一个**私有** bucket，按前缀划分：`assets/`、`wechat-qrcodes/`、`tiles/terra_b3dms/`、`static/cesium/`。**保留原有对象路径**，URL 改写只需替换前缀。
- CDN 加速域名 `media.<域名>`，开启「阿里云 OSS 私有 Bucket 回源」，外部只能经 CDN 访问；HTTPS 证书用阿里云证书服务。
- 缓存：
  - `assets/*` 文件名唯一 → 1 年，`immutable`。
  - `wechat-qrcodes/*` → 长缓存（只在不存在时生成；若重建需刷新 CDN）。
  - `tiles/**/*.b3dm` → 长缓存；`tileset.json` 较短。
- 上传时显式设置 `Content-Type` 与 `Cache-Control`（以前由 Supabase 隐式处理）。

### 5.3 子决策

| | 选项 | 建议 |
|---|---|---|
| 6a 数据库存什么 | 继续存完整 URL；或只存对象 key | **继续存完整 URL，但换成自己的域名**。以后换厂商只改 DNS / 回源，不用再改库 |
| 6b 上传方式 | 浏览器直传 OSS（服务端签名）；经 Next 中转 | **直传，服务端签发 PostObject V4 策略**：限定 key 前缀 `assets/{userId}/`、`content-length-range` ≤ 5 MiB、Content-Type。浏览器端删除（`cleanupUploadedFile`）改为调服务端接口，浏览器不持有删除权限 |
| 6c 防盗链 | Referer 白名单；不开 | 白名单：web 域名 + `servicewechat.com`（小程序请求来源）。**先小范围测试再开**，小程序音频播放可能不带 Referer |
| 6d 3D 瓦片 | 上 OSS+CDN（变为公开可访问）；或保留在需登录的源站 | 能接受公开就上 CDN，从 git 和镜像中移除。是否用 `git filter-repo` 清理历史另行决定（会改写历史，所有人需重新 clone） |
| 6e 音频转码 | worker 容器跑 ffmpeg；阿里云 IMS + OSS 事件触发 | **ffmpeg worker**，上传登记后自动转 m4a，取代手动跑 Cloudinary 脚本 |
| 6f 地图底图 | 现为 cesium.com 加载 + Ion 默认 Bing 影像，内地基本不可用，手机端只有这一层 | **Cesium 自托管到 CDN，底图换天地图**（WGS84，与 GPS 一致；高德为 GCJ-02 会偏移几百米） |

### 5.4 代码改动

新建 `lib/storage/`（OSS 适配器：签名上传、删除、列举、HEAD、公开 URL），配置 `MEDIA_BASE_URL`、`OSS_BUCKET`、`OSS_REGION`；服务器用 ECS 的 RAM 角色授权，不在环境变量里放 AccessKey。

| 文件 | 改动 |
|---|---|
| `lib/upload/service.ts` | 改为先取签名再直传 OSS；显式 Content-Type / Cache-Control；失败清理改调服务端 |
| `lib/storage-cleanup.server.ts` | 路径正则写死了 Supabase 格式，**换 OSS 后删除会静默跳过**，必须改 |
| `app/api/admin/clean/route.ts` | 全桶扫描改用 ListObjectsV2（continuation token、LastModified）+ HeadObject |
| `lib/user-deletion.server.ts` | 批量删除改用 OSS DeleteMultipleObjects |
| `app/manage/actions/wechat-qr.ts`、`lib/wechat-qr.ts` | 上传与 URL 构造改用 OSS / CDN |
| `lib/anchor/reference.server.ts` | 防 SSRF 白名单写死 `NEXT_PUBLIC_SUPABASE_URL` + 存储路径，改为 `MEDIA_BASE_URL`；服务端取参考图可走 OSS 内网地址。注意它用 `redirect: "error"`，CDN 不能返回跳转 |
| `scripts/test-anchor-matching.cjs` | 同步更新上述白名单的测试 |
| `public/js/viewer/`（`index.html`、`src/utils/config.js`） | Cesium 与瓦片地址改为 CDN；底图改天地图 |
| `proxy.ts` | 瓦片移走后无需再匹配；若保留在源站，至少排除静态瓦片路径 |

### 5.5 数据迁移步骤

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
4. **小程序**：提前把 `media.<域名>` 加进 downloadFile / request 合法域名，再发版。
5. **收尾**：Supabase 桶保留只读至少 2 周（旧版小程序缓存、外部分享链接），之后删除。

### 5.6 CORS

需要 `Access-Control-Allow-Origin`（在 OSS bucket 与 CDN 响应头同时配置）：

- 地图中的图片 billboard（`crossOrigin = "anonymous"` 后画到 canvas，缺 CORS 直接失败）；
- 3D 模型预览（drei `useGLTF`）；
- Cesium 瓦片、Cesium 自身资源与 Draco 解码器（若与页面不同源）；
- 浏览器直传：允许 POST，暴露 `ETag`。

`<img>` / `<video>` / `<audio>` 与 `new Audio(url)` 不需要 CORS。

---

## 6. 数据库与认证迁移要点（路线 A）

- **导出**：用 `supabase db dump`（分别导出角色、结构、数据）或 `pg_dump`，包含 `public` 与 `auth`（用户、身份、密码哈希）；`storage` schema 不需要。把完整基线结构提交进仓库，作为之后迁移的起点。
- **角色**：新库需要创建 `anon`、`authenticated`、`service_role`，以及 GoTrue 所需的 `supabase_auth_admin` 等，否则现有迁移中的 GRANT / REVOKE 执行失败。
- **注册触发器**：`auth.users` 上的 `handle_new_user` 触发器建表语句不在仓库，需从导出结果中找回并纳入迁移。
- **密钥**：自托管需要自己生成 JWT secret 与对应的 anon / service_role JWT，替换现有 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（小程序里的 anon key 也会变）。`lib/auth/sms-ticket.server.ts` 的签名密钥由 service role key 派生，换 key 只会让 10 分钟内未用完的短信凭证失效。
- **会话**：`@supabase/ssr` 的 cookie 名取自 Supabase URL，换域名后所有用户需要重新登录一次；密码不变。
- **邮件**：GoTrue 的 SMTP 改用阿里云邮件推送；确认邮件、找回密码的模板从 Supabase 控制台复制；Site URL 与重定向白名单改为新域名。
- **PostgREST 暴露面**：据 `docs/saas-role-refactor.md`，核心表未开 RLS，anon key 又公开在网页与小程序中，持有它可以直接读写核心表（线上实际授权未核实）。自托管时必须收紧：anon 只保留小程序需要的只读表与函数，其余一律收回。
- **识别服务**：`recognize-anchor` 通过 `${SUPABASE_URL}/rest/v1/rpc/...` 调 PostgREST，nginx 保持 `/rest/v1/` 前缀即可不改代码；`x-region` / `SB_REGION` 不再有意义。
- **路线 B 的范围**（如果最终选择）：认证改自写并导入 bcrypt 哈希；约 115 处查询与 10 处 RPC 改为 SQL；客户端两处直连（`components/user-avatar-menu.tsx` 读 `users`、上传服务）改走接口；小程序全部改调 `/api/miniapp/*`。

---

## 7. Next 应用容器化

- `next.config.ts` 增加 `output: "standalone"`；运行时设 `HOSTNAME=0.0.0.0`。
- `NEXT_PUBLIC_*` 在构建时写入客户端代码，需作为 Docker build args 传入。
- 固定版本：`next`（`package.json` 写 `latest`，锁文件解析为 16.x，不是 CLAUDE.md 写的 15）、`@supabase/ssr`、`@supabase/supabase-js`。
- `app/layout.tsx` 的 `VERCEL_URL` 改为站点域名变量（如 `NEXT_PUBLIC_SITE_URL`）。
- `lib/fonts.ts` 的 `next/font/google` 改为 `next/font/local`，否则在内地构建会卡在下载字体。
- 基础镜像用 glibc（Debian slim），或确保 Alpine 下安装 musl 版 sharp（`next/image` 优化本地落地页图片需要）。
- 反向代理需转发 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`：邀请链接由 `new URL(request.url).origin` 生成（`app/api/organizations/[id]/invitations/route.ts`）。
- 镜像不要打进 `public/js/viewer/terra_b3dms`（2.6 GB），瓦片走 CDN。
- 镜像推到阿里云容器镜像服务（ACR）；CI 可沿用 GitHub Actions 构建推送，服务器拉取部署。
- 删除只在 Vercel 生效的 `export const maxDuration`，以及模板遗留组件 `components/deploy-button.tsx`。

---

## 8. 小程序协调

- 新域名（`api.<域名>`、`media.<域名>`）需加入 request / uploadFile / downloadFile 合法域名，需 HTTPS，按微信规则需备案。
- 需要改的地方：Supabase URL 与 anon key、识别接口地址（去掉 `x-region`）、媒体域名（如有写死）。
- 发版要过审核，且用户手机上的旧版本会继续访问旧地址一段时间：切换后 Supabase 至少保持只读运行 2 周。
- 数据契约不能随意改：`organization.config`（及可能仍被读取的 `text_asset_miniapp_style` 列，两份文档说法不一致，需对照小程序代码）、`asset` 字段、`get_nearby_assets`、`danmaku`、识别接口的响应与错误格式。

---

## 9. 分阶段计划

### 阶段 0：准备（现在即可开始，互不阻塞）

- [ ] 启动 ICP 备案（D1）
- [ ] 确认 EAS 所在地域
- [ ] 从线上库导出完整结构并提交进仓库
- [ ] 固定依赖版本
- [ ] Dockerfile（standalone）+ docker compose
- [ ] 替换 `VERCEL_URL`、改用本地字体
- [ ] 修复剩余安全问题（第 10 节）

### 阶段 1：Next 迁到 ECS Docker，下线 Vercel

数据仍连 Supabase 云。此阶段后台会因跨境访问孟买数据库明显变慢，不宜拖太久。

### 阶段 2：存储迁到 OSS + CDN

按第 5 节执行。小程序提前加合法域名。

### 阶段 3：数据库、认证、REST、识别服务切到自建

维护窗口内完成数据导入与切换；小程序同步发版；所有用户重新登录一次。

### 阶段 4：收尾

观察期后关闭 Supabase 项目；更新文档（第 12 节）；清理 `.mcp.json`、`.codex/config.toml`、`.vscode/mcp.json` 中的 Supabase 项目配置。

---

## 10. 安全问题

| 问题 | 状态 |
|---|---|
| `resetPasswordByPhone` / `createUserByPhone` 服务端不校验短信验证码，可重置任意手机号用户的密码 | **已修复**（PR #3，短信验证凭证） |
| `resetPasswordByPhone` 中 `listUsers()` 未分页，超过约 50 个用户后手机号重置失败 | **已修复**（PR #3） |
| 核心表未开 RLS，公开的 anon key 可能可以直接读写（线上授权未核实） | 未处理；迁移时收紧 PostgREST 或走路线 B |
| 生成小程序码的 server action 无鉴权，微信接口额度可被滥用 | 未处理 |
| `POST /api/assets/[id]/matching` 公开，任何人可触发付费 EAS 计算 | 未处理 |

---

## 11. 待确认的信息

- 两个存储桶的对象数量与总大小
- 线上库完整结构、`storage.objects` 权限策略、anon 角色的实际授权
- 小程序代码中调用的表、RPC、接口和写死的域名
- EAS 部署地域
- Supabase 控制台中的 SMTP、邮件模板、Site URL 与重定向配置

---

## 12. 迁移完成后需同步更新的文档

- `CLAUDE.md`：上传去向（Cloudinary → OSS）、Next 版本、Supabase 相关说明、路由表中不存在的 `/admin/clean`
- `README.md`：媒体存储、WebP 说法、`.env.example`（文件不存在）
- `docs/asset-pipeline.md`、`docs/asset-storage-lifecycle.md`：存储 URL 格式与删除流程
- `docs/anchor-matching.md`、`docs/edge-anchor-recognition.md`：Vercel / Supabase 部署与密钥说明
- `docs/wechat-qr-code.md`、`docs/audio-compatibility.md`、`docs/3d-model-preview.md`
