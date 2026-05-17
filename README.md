# 三林老街 AR 记忆 · 全栈项目

> 以增强现实为核心的三林老街文化遗产互动体验平台，由 **Web 管理端**（Next.js）和 **微信小程序 AR 端**（xr-frame）共同构成，共享同一套 Supabase 后端。

---

## 项目概览

| 子项目 | 路径 | 定位 |
|---|---|---|
| **sanlinlaojie** | `sanlinlaojie/` | Web 管理平台 + Web AR 体验 |
| **xr-frame-plant-trees** | `xr-frame-plant-trees/` | 微信小程序 GPS AR 体验 |

两者通过同一个 Supabase 实例共享数据（素材库、组织、工作区、弹幕等）。

---

## 一、Web 管理平台（sanlinlaojie）

### 技术栈

- **框架**：Next.js 15 (App Router) + React 19 + TypeScript
- **UI**：ShadcnUI + Radix UI + TailwindCSS
- **后端/鉴权**：Supabase（PostgreSQL + PostGIS + Auth）
- **媒体存储**：Cloudinary
- **3D 渲染**：Three.js + React Three Fiber
- **AR**：Zappar（Web AR）
- **地图**：OpenStreetMap / CesiumJS
- **国际化**：i18next + react-i18next
- **状态管理**：Zustand

### 主要功能模块

#### 用户端
- `/` — 首页
- `/ar` — Web AR 体验（Zappar，移动端扫码入口）
- `/manage` — 地图工作区主界面：在交互式地图上查看/管理 AR 素材点位

#### 管理端（`/admin`）
- Overview — 组织数据概览
- Members — 成员管理
- Workspaces — 工作区管理（含 QR 码生成）
- Settings — 组织设置
- Cleanup — 废弃素材清理

#### 超级管理员（`/super-admin`）
- User Management — 全局用户管理
- Organizations — 组织管理

#### 文件上传模块（`/upload-onsite` & `lib/upload/`）

支持多种素材类型：

| 类型 | 说明 |
|---|---|
| image | 自动压缩为 WebP，提取 EXIF GPS 信息 |
| video | 视频上传 |
| audio | 音频上传（含压缩） |
| document | PDF、Word 等文档 |
| link | 外部链接 |
| text | 纯文本 |

#### 权限体系（`lib/permissions.ts`）
- 超级管理员（super_admin）
- 组织管理员（org_admin）
- 普通成员（member）
- 访客
- 侧边栏菜单按角色动态过滤

### 目录结构

```
sanlinlaojie/
├─ app/
│  ├─ admin/          # 组织管理后台
│  ├─ ar/             # Web AR 体验页
│  ├─ manage/         # 地图工作区主界面
│  ├─ super-admin/    # 超级管理员控制台
│  ├─ upload-onsite/  # 现场上传页面
│  └─ api/            # API Routes
├─ components/        # 全局可复用组件
├─ hooks/             # 全局 Hooks
├─ lib/
│  ├─ upload/         # 文件上传模块（模块化、可扩展）
│  ├─ supabase/       # Supabase 客户端
│  ├─ permissions.ts  # 权限逻辑
│  ├─ image-compression.ts
│  ├─ audio-compression.ts
│  └─ exif-reader.ts
├─ locales/           # i18n 翻译文件
└─ supabase/          # 数据库迁移脚本
```

### 开发命令

```bash
npm run dev    # 启动开发服务器（localhost:3000）
npm run build  # 生产构建
npm run lint   # ESLint 检查
```

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
- **AR 渲染**：微信 xr-frame 系统
- **后端**：Supabase（与 Web 端共用）
- **定位**：微信 GPS 接口（`wx.startLocationUpdateBackground`）

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
- 节点队列管理（新队列 / 旧队列 / 弹幕队列，各自上限）
- 空间音频、广告牌头像气泡、导航粒子线
- 巨型远景模型管理

#### `miniprogram/components/shop-checkin/`
店铺打卡组件：导航覆层 + 打卡弹窗 + 附近店铺列表

#### `miniprogram/utils/supabase.ts`
配置优先级：扫码参数 > Storage 上次扫码 > 默认兜底值，通过 QR 码动态切换组织/工作区

### 节点队列策略

```
newQueue     ─── 本轮新拉取节点（超限 FIFO 驱逐）
oldQueue     ─── 历史遗留节点（超限按距离驱逐最远的）
danmakuQueue ─── 用户实时弹幕（超限 FIFO 驱逐最旧的）
```

默认上限：新队列 10 / 旧队列 25 / 弹幕 8，拉取半径 50 m，位移触发阈值 5 m。

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
   │  │  ├─ config.js  # 全局 XR 配置
   │  │  ├─ gps.js     # GPS 工具
   │  │  ├─ navigation.js  # 导航逻辑
   │  │  └─ preload.js # 资源预加载
   │  └─ shop-checkin/ # 店铺打卡组件
   └─ utils/
      └─ supabase.ts   # Supabase 配置与扫码参数管理
```

---

## 三、数据库（Supabase + PostGIS）

两个端共用，核心表包括：

- **organizations** — 组织（对应一个物理场景/街区）
- **workspaces** — 工作区（组织下的子空间，通过 QR 码区分）
- **assets** — 素材点位（含 PostGIS 地理坐标、文件类型、元数据）
- **members** — 组织成员与角色
- **danmaku** — 弹幕记录

> 如数据结构有变动，请通过 Supabase MCP 获取最新 schema，不要以本文档为准。

---

## 四、快速上手

### Web 端

```bash
cd sanlinlaojie
cp .env.example .env.local   # 填入 Supabase / Cloudinary 等环境变量
npm install
npm run dev
```

### 微信小程序端

1. 使用微信开发者工具（Nightly 版）打开 `xr-frame-plant-trees/`
2. 在 `miniprogram/utils/supabase.ts` 中确认 `DEFAULT_CONFIG` 指向正确的组织/工作区
3. 编译预览或真机调试（需要 GPS 权限）

---

## 五、相关文档

| 文档 | 说明 |
|---|---|
| [docs/api.md](docs/api.md) | API 接口说明 |
| [docs/i18n-guide.md](docs/i18n-guide.md) | 国际化使用指南 |
| [docs/map-asset-interaction.md](docs/map-asset-interaction.md) | 地图素材交互逻辑 |
| [docs/3d-model-preview.md](docs/3d-model-preview.md) | 3D 模型预览方案 |
| [docs/text-asset-miniapp-style.md](docs/text-asset-miniapp-style.md) | 文本素材小程序样式 |
| [docs/wechat-qr-code.md](docs/wechat-qr-code.md) | 微信 QR 码生成与跳转 |
| [lib/upload/README.md](lib/upload/README.md) | 文件上传模块文档 |
