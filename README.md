# 三林老街 AR 记忆 · 全栈项目

> 以增强现实为核心的三林老街文化遗产互动体验平台，由 **Web 管理端**（Next.js）和 **微信小程序 AR 端**（VisionKit v2 + Three.js）共同构成。Web 端自 2026-10 起部署在阿里云（自建 PostgreSQL + PostGIS、Better Auth、OSS）；小程序端自 2026-10-01 起通过 Web 端的匿名 `/api/miniapp/*` 接口访问同一后端（见 `docs/miniapp-api.md`）。

---

## 项目概览

| 子项目 | 路径 | 定位 |
|---|---|---|
| **sanlinlaojie** | `sanlinlaojie/` | Web 管理平台 |
| **xr-frame-plant-trees** | `xr-frame-plant-trees/` | 微信小程序 GPS AR 体验 |

两者共享同一套数据模型（素材库、组织、工作区、弹幕等）；自建后端的迁移过程见 `docs/aliyun-migration-plan.md`。

---

## 一、Web 管理平台（sanlinlaojie）

### 技术栈

- **框架**：Next.js 16 (App Router) + React 19 + TypeScript
- **UI**：ShadcnUI + Radix UI + TailwindCSS
- **数据库**：PostgreSQL 17 + PostGIS（Docker 自建，Kysely 查询，`db/schema.sql`）
- **鉴权**：Better Auth（邮箱密码 + 阿里云短信手机号）
- **媒体存储**：阿里云 OSS（上传经 `/api/upload` 中转，内容 hash 去重）
- **部署**：阿里云轻量服务器 · Docker Compose（Caddy + Next standalone + PostGIS）
- **3D 渲染**：Three.js + React Three Fiber
- **地图**：OpenStreetMap / CesiumJS
- **国际化**：i18next + react-i18next
- **状态管理**：Zustand

### 主要功能模块

#### 用户端
- `/` — 首页
- `/manage` — 地图主界面：v2 管理投放 Placement，尚未切换的组织保留旧素材地图
- `/manage/assets` — 团队素材库、项目授权、固定版本与使用记录
- `/manage/scenes` — 项目场景；`/manage/scenes/[id]` 编排、预览与发布
- `/auth/*` — 登录 / 注册 / 找回与修改密码
- `/invite/[token]` — 接受组织邀请链接
- `/settings` — 个人设置
- `/instructions/{zh,en}` — 使用说明（MDX）；`/403` — 无权限提示页

#### 管理端（`/admin`）
- Overview — 组织数据概览
- Members — 成员管理
- Workspaces — 工作区管理（含 QR 码生成）
- Settings — 组织设置

#### 超级管理员（`/super-admin`）
- User Management — 全局用户管理
- Organizations — 组织管理
- Error Logs — 错误日志（`/super-admin/error-logs`）
- Cleanup — 死链行 / 孤儿文件清扫（`/super-admin/clean`）
- Settings — 系统设置：新建组织默认允许的素材类型（`/super-admin/settings`）

#### 文件上传模块（`/upload-onsite` & `lib/upload/`）

支持多种素材类型：

| 类型 | 说明 |
|---|---|
| image | 自动压缩为 JPEG，提取 EXIF GPS 信息 |
| video | 视频上传 |
| audio | 音频上传（提取时长等元数据；压缩暂未启用） |
| document | PDF、Word 等文档 |
| link | 外部链接 |
| text | 纯文本 |
| anchor | 匹配点：一张参考图 + 位置，供小程序图像识别（`docs/anchor-matching.md`） |
| shop | 店铺：主图 + 可选打卡凭证照片 |
| model | 3D 模型（.gltf/.glb） |

#### 权限体系（`lib/permissions.ts`）
- 全局角色（`users.role`）：超级管理员 super_admin / 普通用户 user
- 组织角色（`organization_member.role`）：owner / admin / member / viewer
- 项目角色（`workspace_assignment.role`）：manager / editor / viewer；素材使用权与维护权分开
- 侧边栏菜单按角色动态过滤；矩阵见 `docs/permissions.md`

### 目录结构

```
sanlinlaojie/
├─ app/
│  ├─ admin/          # 组织管理后台
│  ├─ manage/         # 地图工作区主界面
│  ├─ super-admin/    # 超级管理员控制台
│  ├─ upload-onsite/  # 现场上传页面
│  └─ api/            # API Routes
├─ components/        # 全局可复用组件
├─ hooks/             # 全局 Hooks
├─ lib/
│  ├─ upload/         # 文件上传模块（模块化、可扩展）
│  ├─ db/             # Kysely 实例与生成的表类型
│  ├─ auth/           # Better Auth 服务端/客户端、手机号短信流程
│  ├─ storage/        # OSS 适配器与公开 URL 工具
│  ├─ permissions.ts  # 权限逻辑
│  ├─ image-compression.ts
│  ├─ audio-compression.ts
│  └─ exif-reader.ts
├─ locales/           # i18n 翻译文件
├─ db/                # schema.sql（基线）+ migrations/
├─ deploy/            # docker-compose、Caddyfile、服务器 env 模板
├─ scripts/           # 部署、数据库迁移、一次性数据迁移脚本
└─ supabase/          # 旧 Supabase 迁移与 Edge Function 存档（已停用，待旧版小程序流量归零后删除）
```

### 开发命令

```bash
npm run dev         # 启动开发服务器（localhost:3000）
npm run build       # 生产构建
npm run lint        # ESLint 检查
npm run db:migrate  # 应用 db/schema.sql 与 db/migrations 到 DATABASE_URL
npm run db:codegen  # 重新生成 lib/db/types.ts
npm run deploy      # 构建镜像并部署到阿里云服务器（scripts/deploy.sh）
```

### 独立 CLI

`sanlin-web-cli` 单独分发，不包含在 Web 项目内。收到安装包后可直接连接线上服务，无需下载本仓库；需要 Node.js 22+。

```bash
npm install --global ./sanlin-web-cli-0.1.0.tgz
export SANLIN_BASE_URL=https://your-web.example
sanlin auth login --account you@example.com
sanlin --help
```

支持组织、工作区、素材、上传、场景、用户、标签、日志及通用 API 操作，完整使用说明随独立安装包提供。

### 组件拆分规范

| 场景 | 放置位置 |
|---|---|
| 多个路由复用、无业务语义 | `/components`（根目录） |
| 只服务当前路由、有业务名称 | `/app/route/components/` |
| < 20 行且无复用价值 | 留在当前文件 |
| 文件 > 120 行 | 必须拆分 |

---

## 二、微信小程序 AR 端（xr-frame-plant-trees）

### 技术栈

- **平台**：微信小程序（TypeScript）
- **AR 渲染**：微信 VisionKit v2 + Three.js（`miniprogram/lib/three-runtime/`，2026-10-09 起替代原 xr-frame 方案）
- **后端**：Web 端匿名接口 `/api/miniapp/*`（`miniprogram/utils/backend.ts`，与 Web 端共用同一数据库）
- **定位**：微信 GPS 接口（`wx.startLocationUpdate` + `onLocationChange`，失败时退化为轮询）

### 核心体验

用户在三林老街现场打开小程序，手机摄像头实时叠加：

1. **GPS 感知素材**：图片、视频、音频、3D 模型等按地理坐标投影到 AR 世界
2. **弹幕发送**：用户发出的文字以 AR 飘字形式呈现在真实环境中
3. **店铺打卡**：附近商铺的导航指引与打卡功能
4. **大地标模型**：远景巨型 3D 模型（距离感知）
5. **粒子特效 & 彩带**：种树庆典视觉反馈

### 主要组件

#### `miniprogram/components/xr-start/`
AR 主组件，负责：
- GPS 持续监听与坐标转换（GPS → XR 世界坐标）
- 按距离阈值分批拉取附近素材（防抖 + 冷却机制）
- 容量桶管理（heavy / light / audio / transient 各自上限，不跨桶驱逐）
- 空间音频、朝向相机的程序化文字气泡、匹配点识别（`matching/`）
- 巨型远景模型管理

#### `miniprogram/components/shop-checkin/`
店铺打卡组件：导航覆层 + 打卡弹窗 + 附近店铺列表

#### `miniprogram/utils/backend.ts`
后端访问层（封装 `/api/miniapp/*`）与扫码配置。配置优先级：扫码参数 > Storage 上次扫码 > 默认兜底值，通过 QR 码动态切换组织/工作区

### 节点容量策略

所有已放置节点在同一个 `nodeList` 中，按素材类型归入独立容量桶（`components/xr-start/config.js` 的 `buckets`），桶与桶之间互不驱逐：

```
heavy      ─── model / video（上限 6，超限按距离驱逐最远的）
light      ─── text / image（上限 20，超限按距离驱逐最远的）
audio      ─── 空间音频（上限 6，超限按距离驱逐最远的）
transient  ─── 用户实时弹幕（上限 8，超限 FIFO 驱逐最旧的）
```

拉取半径 20 m，位移触发阈值 5 m，冷却 3 s；每轮最多揭示 10 个新素材（首轮 20）。详见 `xr-frame-plant-trees/docs/node-list-queue-strategy.md`。

### 目录结构

```
xr-frame-plant-trees/
└─ miniprogram/
   ├─ pages/
   │  ├─ ar/           # AR 主页面
   │  ├─ index/        # 首页
   │  └─ upload/       # 素材上传页
   ├─ components/
   │  ├─ xr-start/     # AR 核心组件
   │  │  ├─ assets/    # 素材加载逻辑
   │  │  ├─ effects/   # 弹幕/粒子/彩带特效
   │  │  ├─ matching/  # 匹配点识别（调用 /api/miniapp/anchors/recognize）
   │  │  ├─ config.js  # 全局 AR 配置
   │  │  ├─ gps.js     # GPS 工具
   │  │  └─ navigation.js  # 导航逻辑
   │  └─ shop-checkin/ # 店铺打卡组件
   ├─ lib/
   │  └─ three-runtime/ # VisionKit v2 会话 + Three.js 渲染运行时
   └─ utils/
      └─ backend.ts    # /api/miniapp/* 访问层与扫码参数管理
```

---

## 三、数据库（PostgreSQL + PostGIS）

结构以 `db/schema.sql` 为准（含全部函数与触发器）。核心表包括：

- **organization / organization_member** — 团队所有权、组织角色与内容模型切换状态。
- **workspace / workspace_assignment** — 项目与项目协作角色，保留二维码参数和原 UUID。
- **asset / asset_version / asset_version_resource** — 素材身份、不可变内容版本与文件保留清单。
- **asset_workspace_grant** — 同组织项目使用素材的授权。
- **scene / scene_revision** — 编排草稿、固定发布版本与派生依赖索引。
- **placement** — 一次空间投放，固定引用素材版本或场景发布版本。

这些是 v2 模型。组织状态为 `legacy/preparing` 时保留旧 Asset 写入，`readonly` 为切换窗口，`v2` 才启用新写源。数据库迁移不会自动切换业务；旧匿名文字、Anchor、Shop 和公开 ID 通过兼容层处理。见 [数据层](docs/data-layer.md)。

---

## 四、快速上手

### Web 端

```bash
cd sanlinlaojie
cp deploy/env.example .env.local   # 填入数据库、阿里云 AccessKey、OSS 等变量
docker run -d --name sanlin-dev-db --platform linux/amd64 -e POSTGRES_PASSWORD=sanlin -e POSTGRES_DB=sanlin -p 55432:5432 postgis/postgis:17-3.5
npm install
npm run db:migrate
npm run dev
```

### 微信小程序端

1. 使用微信开发者工具（Nightly 版）打开 `xr-frame-plant-trees/`
2. 在 `miniprogram/utils/backend.ts` 中确认 `DEFAULT_CONFIG` 指向正确的组织/工作区
3. 编译预览或真机调试（需要 GPS 权限）

---

## 五、相关文档

| 文档 | 说明 |
|---|---|
| [docs/team-assets-scenes-refactor-plan.md](docs/team-assets-scenes-refactor-plan.md) | 团队素材复用与场景管理改造方案：目标、迁移顺序与验收依据；实现说明见下列专题文档 |
| [docs/content-model-validation.md](docs/content-model-validation.md) | 首期实现结果、隔离环境验证与上线边界 |
| [docs/content-model-migration-runbook.md](docs/content-model-migration-runbook.md) | 旧数据审计、回填、核验、切换和回退操作手册 |
| [docs/scene-asset.md](docs/scene-asset.md) | 独立场景、固定版本发布与 legacy 场景兼容 |
| [docs/api.md](docs/api.md) | API 接口说明 |
| [docs/i18n-guide.md](docs/i18n-guide.md) | 国际化使用指南 |
| [docs/map-asset-interaction.md](docs/map-asset-interaction.md) | 投放地图 ID、消息适配与 legacy 素材交互 |
| [docs/3d-model-preview.md](docs/3d-model-preview.md) | 3D 模型预览方案 |
| [docs/text-asset-miniapp-style.md](docs/text-asset-miniapp-style.md) | 文本素材小程序样式 |
| [docs/wechat-qr-code.md](docs/wechat-qr-code.md) | 微信 QR 码生成与跳转 |
| [docs/asset-storage-lifecycle.md](docs/asset-storage-lifecycle.md) | 内容 hash 去重与文件删除机制 |
| [lib/upload/README.md](lib/upload/README.md) | 文件上传模块文档 |
| [docs/data-layer.md](docs/data-layer.md) | 数据库 / 认证 / 存储模块约定 |
| [docs/miniapp-api.md](docs/miniapp-api.md) | 小程序匿名接口（`/api/miniapp/*`） |
| [docs/permissions.md](docs/permissions.md) | 组织/项目角色、素材使用与维护权限 |
| [docs/aliyun-migration-plan.md](docs/aliyun-migration-plan.md) | 阿里云迁移方案与执行记录 |
