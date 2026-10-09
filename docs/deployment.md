# 部署与运维手册

这份文档汇总 Web 平台在阿里云上的部署方式、资源和日常操作，状态截至 **2026-10-09**。迁移的来龙去脉见 [aliyun-migration-plan.md](aliyun-migration-plan.md)。数据层约定见 [data-layer.md](data-layer.md)。

> 本仓库是公开的。这里只写资源名称和操作方法，不写任何密钥、密码或令牌。真实值在服务器的 `/opt/sanlin/.env` 和本地被 git 忽略的 `deploy/.env.production` 里。

## 1. 总览

```text
小程序 / 浏览器
   │ HTTPS
   ▼
轻量应用服务器（上海）  /opt/sanlin，Docker Compose
   ├─ caddy   TLS 证书 + 反向代理（80/443）
   ├─ app     Next.js（sanlin-web 镜像）
   └─ db      PostgreSQL 17 + PostGIS（只监听 127.0.0.1）
        │
        ├─▶ OSS sanlinlaojie-media      媒体文件（公共读）
        ├─▶ OSS sanlinlaojie-backups    每晚数据库备份（私有）
        └─▶ PAI-EAS sage_anchor_gpu     锚点识别模型（A10，走内网）
```

## 2. 资源清单

| 资源 | 规格 / 位置 | 说明 |
|---|---|---|
| 服务器 | 轻量应用服务器 `Ubuntu-gfoj`，上海，公网 IP `139.196.189.102` | 2 vCPU，1.6 GB 内存 + 2 GB swap，40 GB 磁盘；Ubuntu 24.04，Docker 29.8。只允许 root 用 SSH 密钥登录，密码登录已关闭。服务器访问不了 Docker Hub，镜像都从本地或 CI 通过 SSH 传过去。 |
| 部署目录 | `/opt/sanlin` | `docker-compose.yml`、`Caddyfile`（以及 `Caddyfile.ip` / `Caddyfile.domain`）、`.env`、`backup.sh`、`backups/` |
| 容器 | `caddy:2-alpine`、`sanlin-web:latest`、`postgis/postgis:17-3.5` | 数据库数据在 `db-data` 卷，证书在 `caddy-data` 卷 |
| 媒体存储 | OSS `sanlinlaojie-media`（上海，公共读） | `assets/`、`wechat-qrcodes/`、`static/cesium/1.111/`、`static/draco/gltf/`、`tiles/terra_b3dms/`。CORS 允许任意来源 GET/HEAD。为了公共读，桶的"阻止公共访问"已关闭。 |
| 备份存储 | OSS `sanlinlaojie-backups`（私有） | `db/` 下的对象 30 天后自动删除（生命周期规则） |
| 访问密钥 | RAM 用户 `sanlin-app` | 只有 OSS 这两个桶和号码认证（短信）的权限；AccessKey 只放在服务器 `.env` 里 |
| 识别模型 | PAI-EAS `sage_anchor_gpu`（上海） | 见 [§7](#7-识别模型pai-eas) |
| 域名 | `spatialmemory.online` | DNS 的 `@`、`www` 都指向服务器，但阿里云因 ICP 备案拦截，目前不可用，见 [§6](#6-https-与域名) |
| GitHub | `WangZhewei1027/sanlinlaojie` | 见 [§3.1](#31-自动部署推荐) |

## 3. 发布

### 3.1 自动部署（推荐）

合并到 `main`（或直接推送）后，GitHub Actions 的 `Deploy` 工作流（`.github/workflows/deploy.yml`）会依次执行：

1. 在 CI 里构建 `linux/amd64` 镜像。`NEXT_PUBLIC_*` 在构建时写进前端代码，取自仓库变量。
2. `docker save | ssh docker load` 把镜像传到服务器。
3. 复制 `docker-compose.yml`、`backup.sh` 和两份 Caddyfile。服务器 `.env` 里的 `CADDYFILE` 决定启用哪一份。
4. `docker compose up -d`，然后请求首页做冒烟测试。

它**不会**做的事：
- 不运行数据库迁移，迁移见 [§5](#5-数据库)。
- 不修改服务器上的 `.env`，运行时配置以服务器上的为准。

仓库设置：

| 类型 | 名称 | 当前值 |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | 能以 root 登录服务器的 ed25519 私钥 |
| Variable | `DEPLOY_HOST` | `139.196.189.102` |
| Variable | `NEXT_PUBLIC_SITE_URL` | `https://139.196.189.102`（ICP 备案通过后改成域名） |
| Variable | `NEXT_PUBLIC_MEDIA_BASE_URL` | `https://sanlinlaojie-media.oss-cn-shanghai.aliyuncs.com` |
| Variable | `NEXT_PUBLIC_TIANDITU_KEY` | 未设置（可选） |
| Ruleset | `Protect main` | 合并需要 1 个审批，禁止强推和删除分支。仓库所有者合并自己的 PR 时用 `gh pr merge <编号> --merge --admin`。 |

查看部署：

```bash
gh run list --workflow Deploy --limit 5
```

```bash
gh run watch <run-id> --exit-status
```

### 3.2 手动部署

```bash
npm run deploy
```

`scripts/deploy.sh` 在本地构建镜像并经 SSH 发布，需要：本地 Docker 在运行、SSH 密钥能登录服务器、本地有 `deploy/.env.production`。和自动部署有三点区别：

- **会用本地的 `deploy/.env.production` 覆盖服务器的 `.env`。** 两份要保持一致，改配置时两边都改。
- 发布的是本地工作区，包括未提交的改动，镜像标签带 `-dirty`。下一次推送到 `main` 的自动部署会把它覆盖掉。
- 会安装或刷新每晚备份的定时任务和 `ossutil`。

`SKIP_BUILD=1 npm run deploy` 跳过构建，重新发布上一次构建的镜像。

### 3.3 发布后检查

```bash
ssh root@139.196.189.102 'cd /opt/sanlin && docker compose ps && docker compose logs app --since 10m | tail -50'
```

识别链路可以用小程序调试日志里的 `serverTimingsMs` 检查。正常一轮服务端 `api_total_ms` 约 60–90 ms，其中模型 `model_request_ms` 约 45–65 ms。容器重启后的第一个请求会慢一些（几百毫秒）。

## 4. 配置

- **运行时配置以服务器 `/opt/sanlin/.env`（权限 600）为准。** 本地 `deploy/.env.production` 是它的副本，被 git 忽略。完整的变量列表和说明见 [`deploy/env.example`](../deploy/env.example)。
- `NEXT_PUBLIC_*` 是构建时变量：自动部署取 GitHub 仓库变量，手动部署取本地 env 文件。改了以后要重新构建镜像，只重启容器不生效。
- 改其他变量：同时改服务器 `.env` 和本地副本，然后在服务器执行 `cd /opt/sanlin && docker compose up -d app`。也可以改本地副本后直接手动部署。

当前的非敏感配置：

| 变量 | 值 |
|---|---|
| `CADDYFILE` | `Caddyfile.ip` |
| `SITE_ADDRESS` | `139.196.189.102` |
| `NEXT_PUBLIC_SITE_URL` | `https://139.196.189.102` |
| `SAGE_EAS_ENDPOINT` | `http://<阿里云账号 UID>.vpc.cn-shanghai.pai-eas.aliyuncs.com/api/predict/sage_anchor_gpu`（内网地址；本地开发用公网 https 地址） |
| `SAGE_MATCH_THRESHOLD` / `SAGE_MATCH_MARGIN` | `0.3` / `0.03` |
| 未配置 | SMTP（邮件验证、找回密码不可用）、天地图 key、媒体 CDN |

## 5. 数据库

- PostgreSQL 17 + PostGIS 3.5，跑在 `db` 容器里，端口只绑定服务器的 `127.0.0.1:5432`，外部连不上。
- **结构**：`db/schema.sql` 是基线，增量改动放在 `db/migrations/<时间戳>_<名称>.sql`，已执行的记录在 `schema_migrations` 表。线上目前已执行：`schema.sql`（2026-10-01）和 `20261008000000_anchor_match_rate_limit_param.sql`。
- **执行迁移**（自动部署不会跑迁移）：

```bash
scripts/db-tunnel.sh
```

另开一个终端（密码是服务器 `.env` 里的 `POSTGRES_PASSWORD`）：

```bash
DATABASE_URL=postgres://sanlin:<POSTGRES_PASSWORD>@127.0.0.1:15432/sanlin npx tsx scripts/db/migrate.ts
```

  顺序是**先迁移，再发布应用**。迁移要兼容正在运行的旧版本，比如新参数给默认值，这样两步之间线上不会出错。

- **临时查询**：

```bash
ssh root@139.196.189.102 'cd /opt/sanlin && docker compose exec -T db psql -U sanlin -d sanlin'
```

- **备份**：服务器每天 03:30 执行 `/opt/sanlin/backup.sh`。它用 `pg_dump` 导出，经 OSS 内网地址上传到 `oss://sanlinlaojie-backups/db/`，保留 30 天；本地 `/opt/sanlin/backups` 只留 3 天。日志在 `/var/log/sanlin-backup.log`。目前每份约 780 KB，10 月 7–9 日每天都成功。
- **恢复**（会覆盖现有数据，先确认）：

```bash
ossutil cp oss://sanlinlaojie-backups/db/<文件名> .
```

```bash
docker compose exec -T db pg_restore -U sanlin -d sanlin --clean --if-exists < <文件名>
```

## 6. HTTPS 与域名

**现在：用 IP 访问（`Caddyfile.ip`）**
- 证书是 Let's Encrypt 签发的 IP 证书，有效期 6 天（`shortlived` 配置），Caddy 自动续期。2026-10-08 第一次自动续期成功，当前证书有效至 10 月 15 日。
- 签发失败时，Caddy 退回自签证书：浏览器会提示不安全，但 HTTPS 仍可用。
- 客户端用 IP 访问时不带 SNI，所以配置里有 `default_sni`。
- 踩过的坑：更换证书签发方式后要用 `docker compose restart caddy`，用 `caddy reload` 会导致 TLS 握手失败。存储里如果还有有效的旧自签证书，Caddy 会继续用它；当时是把 `/data/caddy/certificates/local/<IP>` 移到 `/data/caddy/backup-local/` 才让它重新签发。

**域名 `spatialmemory.online`：被 ICP 拦截**
- DNS 已指向服务器，但阿里云按请求的 Host 拦截未备案的域名，返回 403 "Non-compliance ICP Filing"。
- 备案（或备案接入阿里云）完成后的切换步骤：
  1. 服务器 `.env` 和本地副本改为 `CADDYFILE=Caddyfile`、`SITE_ADDRESS=spatialmemory.online, www.spatialmemory.online`、`SITE_DOMAIN=spatialmemory.online`、`NEXT_PUBLIC_SITE_URL=https://spatialmemory.online`、`AUTH_TRUSTED_ORIGINS=https://www.spatialmemory.online`（现在为空）。
  2. GitHub 变量 `NEXT_PUBLIC_SITE_URL` 改成同样的值，然后重新部署。新的 Caddyfile 用 `docker compose restart caddy` 加载。
  3. `deploy/Caddyfile` 只服务域名。如果还要保留 IP 访问，需要另加一个 IP 站点块。
  4. 小程序的 API 地址改成域名，并在微信后台配置合法域名，见 [§9](#9-小程序)。

## 7. 识别模型（PAI-EAS）

| 项目 | 现状 |
|---|---|
| 服务 | `sage_anchor_gpu`，上海，公共资源组按量付费 |
| 规格 | `ecs.gn7i-c8g1.2xlarge`：整张 A10（24 GB），8 vCPU，30 GB 内存。2026-10-08 从 T4/4 换来。 |
| 价格 | ¥10.50/小时（T4/4 是 ¥3.60），按分钟计费，只在实例运行时收费。2026 年 9 月 PAI 账单 ¥25.2，当时还是 T4/4。 |
| 扩缩容 | 0–1 个实例。30 分钟没有请求就缩到 0；下一个请求会唤醒它，**冷启动要几分钟**：T4/4 实测约 3.5 分钟，A10 新建实例实测 2–7 分钟，A10 从 0 唤醒还没单独测过。 |
| 精度 / 代码 | FP32；服务代码版本 `fb8067eafb0d9e03` |
| 性能（2026-10-08） | 每张 480×640 帧：GPU 推理约 16 ms，模型服务总计约 22 ms；6 路并发时每秒约 43 张，大约够 40 人同时扫描（每人每秒 1 帧） |
| 排队 | 1 个在算，最多 6 个等待，最多等 3 秒，超出返回 429（`model_queue_full` / `model_queue_timeout`，1 秒后重试）。解码和预处理不占排队位，可以并行。 |

- **连接**：服务器走 VPC 内网地址，不用 TLS。`lib/anchor/model-client.server.ts` 用独立的 keep-alive 连接池，空闲连接保留 150 秒。EAS 网关约 180 秒断开空闲连接，我们先断，避免复用一个快要被对方关掉的连接。网关本身每次约 25 ms。
- **模型服务代码**在 ai-location 项目的 `deploy/sage/` 目录（本地目录，不在 git 里）：`service.py` 和 `start_gpu_offline.sh`。更新流程：
  1. 把这两个文件上传到 PAI 默认 OSS 桶的 `sage-service/<版本号>/`，版本号取两个文件内容哈希的前 16 位。
  2. 更新服务的 `/mnt/sage-service` 挂载路径。用 `deploy_service_update.py --apply`，或用 `aliyun eas UpdateService` 提交完整配置。
  3. 更新是滚动的：新实例就绪后旧实例才下线，识别不中断，耗时 3–7 分钟。
- **回滚**：每次改动前的完整配置存在 ai-location 的 `deploy/sage/generated/gpu/service-before-*.json`（权限 600），把规格或挂载路径改回去再提交即可。
- **基准测试**：方法和数据见 ai-location 的 `deploy/sage/GPU.md` 末尾。可以在临时服务上做 A/B 测试，测完删除。
- 查看状态：

```bash
aliyun eas DescribeService --ClusterId cn-shanghai --ServiceName sage_anchor_gpu --region cn-shanghai
```

```bash
aliyun eas ListServiceInstances --ClusterId cn-shanghai --ServiceName sage_anchor_gpu --region cn-shanghai
```

## 8. 识别接口的限流

| 层级 | 上限 | 怎么区分 | 超出后 |
|---|---|---|---|
| 每台设备 | 90 次/分钟 | 小程序的 `X-Client-Id`；没有时按 IP。计数在应用进程内存里。 | `429 client_rate_limited`，只影响这台设备，等到这一分钟窗口结束 |
| 每个工作空间 | 3000 次/分钟 | 数据库计数，由 `consume_anchor_match_request(workspace, limit)` 执行 | `429 workspace_rate_limited`，整个工作空间等到这一分钟结束 |
| 模型排队 | 见 §7 | — | `429 model_queue_full` / `model_queue_timeout`，1 秒后重试 |

- 小程序每秒取一帧，即每台设备每分钟 60 次。
- 工作空间上限故意设得略高于 A10 的处理能力（约 2600 次/分钟）：超出模型能力时由模型排队拒绝单个请求，而不是把整个工作空间锁一分钟。
- 两个数字写在代码里：`app/api/miniapp/anchors/recognize/route.ts` 和 `lib/anchor/recognize.server.ts`。

## 9. 小程序

- 新版本在小程序仓库 `xr-frame-plant-trees` 的 `aliyun-backend` 分支，**还没推送，也没发布**。
  - API 地址暂时是 `https://139.196.189.102`，只在 `miniprogram/utils/backend.ts` 一处配置。
  - `project.private.config.json` 关闭了域名校验。
  - 会随请求发送设备 ID（`X-Client-Id`）。
- 微信不允许把 IP 配成合法域名，所以 ICP 备案前只能在开发者工具或真机调试模式下使用。
- 备案后：API 地址改成 `https://spatialmemory.online`，并在微信后台把站点域名和媒体域名配进 request / uploadFile / downloadFile 合法域名。
- 接口说明见 [miniapp-api.md](miniapp-api.md)。已发布的旧版小程序仍直连 Supabase，所以 `supabase/` 目录在旧版本的流量消失前要保留。

## 10. 常用命令

```bash
ssh root@139.196.189.102 'cd /opt/sanlin && docker compose ps'
```

```bash
ssh root@139.196.189.102 'cd /opt/sanlin && docker compose logs caddy --since 1h | tail -50'
```

```bash
ssh root@139.196.189.102 'tail -5 /var/log/sanlin-backup.log'
```

```bash
echo | openssl s_client -connect 139.196.189.102:443 2>/dev/null | openssl x509 -noout -issuer -dates
```

```bash
ssh root@139.196.189.102 'cd /opt/sanlin && docker compose restart app'
```

## 11. 遗留事项

- **ICP 备案**：通过后按 [§6](#6-https-与域名) 切回域名，同时处理小程序合法域名。
- **小程序**：推送并发布 `aliyun-backend` 分支。
- **Vercel**：GitHub 上的 Vercel 集成仍在为每个 PR 和 `main` 构建部署（PR 检查里的 "Vercel"）。已经不用了，可以在 Vercel 断开仓库或删除项目。
- **Supabase**：旧版小程序还在用，等发布新版、旧版流量消失后再停用项目。
- **未配置**：SMTP、天地图 key、媒体 CDN。
- **网站服务器只有 2 核**：6 台设备同时识别时，接口耗时中位数约 180 ms，模型只占其中约 60 ms。使用人数明显增加时，服务器可能先成为瓶颈。
- **诊断信息**：模型返回的 `preprocess_ms` 还没接入网站的识别诊断。
- **自动部署的冒烟测试**：`curl -k` 旁的注释还写着"自签证书"，现在已是 Let's Encrypt，`-k` 保留无害。
