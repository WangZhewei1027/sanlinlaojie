# 微信小程序二维码功能

## 概述

提供二维码入口按钮。用户点击后，向下弹出一个 Popover，内含对应团队/合集（工作空间）的微信小程序二维码。扫码后可在微信中直接跳转至对应空间。

> 2026-10 团队工作台：v2 团队在 `/manage/collections/[id]` 顶栏显示该合集的二维码，在 `/manage/collections` 页头显示团队级二维码（原“全部项目”）；按钮通过 `organizationId` / `workspaceId` props 显式指定目标。legacy 团队仍在面包屑右侧显示按持久化选择生成的二维码。二维码参数与对象键不变，已印刷的二维码继续有效。

适用路由（legacy 团队的面包屑按钮）：`/admin`、`/manage`、`/upload-onsite`。只有选中了团队后，按钮才会渲染。

**核心设计原则：存储路径即缓存键。** 同一 (org, workspace) 组合的二维码内容永不变化，因此每一层缓存都可以无限期保留，不需要失效机制。缓存命中路径（绝大多数请求）完全不经过服务端。

---

## 文件结构

```
lib/wechat-qr.ts                     # 共享常量 + URL 构造（客户端/服务端单一来源）
app/manage/actions/wechat-qr.ts      # Server Action：生成二维码（仅缓存未命中时调用）
components/workspace-qr-button.tsx   # 客户端 UI：Popover + 乐观加载 + 内存缓存
components/breadcrumb-nav.tsx        # 集成入口（在右侧渲染按钮）
components/ui/popover.tsx            # shadcn Popover 组件
locales/en.json / zh.json            # i18n 文案（workspace.qr* 键）
```

`lib/wechat-qr.ts` 是客户端安全的共享模块，定义 `env_version`、对象 key 格式（前缀 `wechat-qrcodes/` 来自 `lib/storage/public-url.ts` 的 `WECHAT_QR_PREFIX`）和公开 URL 构造。**服务端上传和客户端拼 URL 都必须经过它**——路径格式就是缓存键，两侧不一致会导致缓存永远无法命中。

---

## 请求到缓存全链路

### 命中路径（零服务端参与）

1. 用户点击按钮，`WorkspaceQrButton` 先查**模块级内存 Map**（键为 `orgId__workspaceId`，存本页会话内已确认加载成功的 URL）。
2. Map 未命中则**本地拼接确定性公开 URL**（`buildQrPublicUrl`，纯字符串运算，无网络请求）。公开 bucket 的 URL 格式固定：
   ```
   {NEXT_PUBLIC_MEDIA_BASE_URL}/wechat-qrcodes/release/{orgId}__{wsId|none}.png
   ```
3. `<Image loading="eager">` 直接加载该 URL。浏览器 HTTP 缓存（`cache-control: public, max-age=31536000`，一年）命中则 0 网络请求；否则打到 OSS 媒体域名（`NEXT_PUBLIC_MEDIA_BASE_URL`）。
4. `onLoad` 触发后把 URL 写回 Map 并显示图片。

### 回退路径（仅全新组合走一次）

5. 文件不存在时 OSS 返回 404（`NoSuchKey`），触发 `onError`，调用 Server Action `getOrCreateWorkspaceQRCode`（仅登录用户可调用，生成会消耗微信接口配额）。每个 (org, workspace) 上下文最多回退一次（`attemptedGenerate` ref 守卫），防止 `onError → 生成 → onError` 死循环。
6. 服务端用 `headObject()`（`lib/storage/oss.ts`，仅 HEAD 请求，不传文件体）做二次确认——防止并发重复生成；检查本身抛错按未命中处理（重复上传同一内容无害，见"竞态安全"）。
7. 未命中则获取微信 `access_token`（模块级内存缓存，有效 7200 秒、预留 60 秒余量；进程重启丢失后重取一次）。
8. 调 `getwxacode` 生成 PNG，用 `putObject()` 上传到 OSS，带 `Cache-Control: public, max-age=31536000`。
9. 返回公开 URL，客户端附加 `?v=时间戳` 绕过浏览器可能缓存的 404 响应，回到第 3 步重新加载。

### 各层缓存一览

| 层 | 位置 | 生命周期 | 失效方式 |
|---|---|---|---|
| 内存 Map | 客户端模块作用域 | 本页会话（刷新即清） | 无需失效 |
| HTTP 缓存 | 浏览器 | 一年 | 无需失效 |
| PNG 对象 | Aliyun OSS（`wechat-qrcodes/` 前缀） | 永久 | 手动删除对象 |
| 微信 token | 服务端进程内存 | 2 小时 | 自动过期 |

延迟预期：老用户重开约 0ms；新会话首开一次 OSS 请求（几十到几百毫秒）；全新组合首次生成约 1–2 秒（微信 API + 上传）。

**强制重新生成某个二维码**：在 OSS 控制台（bucket `sanlinlaojie-media`）删除 `wechat-qrcodes/release/…png` 对应对象，下次打开自动走回退路径重建。

---

## 存储机制

### OSS 存储

- **位置**：媒体 bucket（`OSS_BUCKET`，当前为 `sanlinlaojie-media`）下的 `wechat-qrcodes/` 前缀（`lib/storage/public-url.ts` 的 `WECHAT_QR_PREFIX`）
- **访问策略**：bucket 为 public-read（直接通过公开 URL 访问，无需鉴权）
- **类型**：上传时指定 `contentType: "image/png"`
- **缓存头**：上传时设置 `Cache-Control: public, max-age=31536000`（一年）。历史：Supabase 时期 2026-07 之前的存量文件默认是 `no-cache`，已通过脚本批量重传刷新。

### 文件命名规则

```
<env_version>/<organizationId>__<workspaceId|none>.png
```

| 场景 | 路径 |
|------|------|
| 仅选中组织，无工作空间 | `release/abc-org-id__none.png` |
| 选中组织 + 工作空间 | `release/abc-org-id__ws-123.png` |

`env_version` 当前硬编码为 `"release"`（`lib/wechat-qr.ts` 的 `WECHAT_QR_ENV_VERSION`）。历史 `develop/` 目录下的文件不影响 `release/` 路径的使用。

---

## Server Action：`getOrCreateWorkspaceQRCode`

文件：`app/manage/actions/wechat-qr.ts`

### 接口签名

```typescript
export async function getOrCreateWorkspaceQRCode(input: {
  organizationId: string;
  workspaceId?: string | null;
}): Promise<{ url?: string; error?: string }>
```

### 执行流程

```
调用方（客户端 onError 回退）
   │
   ▼
getSessionUser() 未登录 → 返回 { error: "未授权" }
   │
   ▼
校验 organizationId 非空
   │
   ▼
key = buildQrObjectKey(orgId, wsId)
   │
   ▼
headObject(key)                      ← HEAD 请求，零文件传输
   ├─ 非 null ─▶ mediaUrl(key) → 返回 { url }
   ├─ 抛错 ──▶ 视为未命中（继续向下，重复上传无害）
   │
   └─ null
         │
         ▼
      getAccessToken()               ← 模块级内存缓存，60s 安全边界
         │
         ▼
      POST /wxa/getwxacode
      { path, env_version, width: 430 }
         │
         ├─ content-type: application/json → 解析 errmsg → 返回 { error }
         │
         └─ content-type: image/png
               │
               ▼
            putObject(key, buffer,
              { contentType: "image/png",
                cacheControl: "public, max-age=31536000" })
               └─ 返回 { url }（OSS 直接覆盖写，无"已存在"分支）
```

### 微信小程序路径

```
pages/index/index?organizationId=<orgId>[&workspaceId=<wsId>]
```

`workspaceId` 为可选参数，仅在已选中工作空间时追加。

### access_token 缓存

模块级变量 `tokenCache: { token, expiresAt }`，过期前 60 秒视为无效并重新获取。同一 Node.js 进程内共享，进程重启会重新获取，但不超过微信每日限额（单实例部署；横向扩容前需改为共享缓存，如 Redis）。

---

## 客户端组件：`WorkspaceQrButton`

文件：`components/workspace-qr-button.tsx`

### 缓存与状态

- **模块级 `confirmedQrUrls: Map<string, string>`**：键为 `orgId__workspaceId`，只存已确认加载成功的 URL。声明在模块作用域（非 React state），生命周期到页面刷新为止，弹窗开关和 org/workspace 切换均不清空；写入不触发重渲染（旁路缓存，读链为 `generatedUrl ?? Map.get(key) ?? 拼接URL`）。
- 组件 state：`generatedUrl`（回退生成后的带 `?v=` URL）、`loaded`、`generating`、`error`；`useEffect` 监听 cacheKey 变化时重置。
- `attemptedGenerate` ref：每个上下文最多回退生成一次。

### 交互行为

| 状态 | 显示内容 |
|------|----------|
| `selectedOrganizationId` 为空 | 不渲染按钮 |
| 图片加载中 / 回退生成中 | Skeleton + "生成中…" |
| 加载成功 | 显示图片 |
| 回退生成失败（或二次加载仍失败） | 红色错误文案 |

### ⚠️ 已知陷阱：`loading="eager"` 不可移除

图片在加载完成前挂 `hidden`（`display:none`）class，而 `next/image` 默认输出原生 `loading="lazy"`。**`display:none` 的懒加载图片没有布局盒、永远不会进入视口，浏览器根本不发起请求**——`onLoad`/`onError` 都不触发，表现为骨架屏无限等待且无任何报错。因此 `<Image>` 上的 `loading="eager"` 是必需的，源码中留有注释说明。

### 调试：观察缓存是否命中

`confirmedQrUrls` 是模块闭包变量，不挂在 `window` 上，DevTools 无法直接查看。观察方式：

1. **Network 面板（推荐）**：筛选 Img，反复开关弹窗。Map 命中时不产生任何新请求；刷新页面后首开显示 `(disk cache)` 或真实 CDN 请求。
2. **Sources 断点**（dev 模式有 source map）：在 `handleImageLoad` 打断点，Scope 面板可见 Map 完整内容。
3. 临时 `window.__qrUrls = confirmedQrUrls`（仅开发调试，用完删除）。

---

## 竞态安全

同一 (org, workspace) 组合同时从两个 Tab 首次请求时：

1. 两个客户端的公开 URL 均 404 → 各自触发 onError 回退。
2. 两个 Server Action 的 `headObject()` 均返回 null，均调用 `getwxacode` 生成。
3. 两次 `putObject()` 都成功（OSS 直接覆盖写，内容相同），返回相同 URL。
4. 用户无感知，两个 Tab 均正常显示图片。

代价是极端并发下多调一次微信生成接口，可接受。

---

## i18n 键

`locales/en.json` 和 `locales/zh.json` 的 `workspace` 命名空间：

| 键 | 英文 | 中文 |
|----|------|------|
| `workspace.qrButton` | Show QR Code | 显示二维码 |
| `workspace.qrTitle` | Scan to enter mini-program | 扫码进入小程序 |
| `workspace.qrLoading` | Generating... | 生成中… |
| `workspace.qrError` | Failed to load QR code | 二维码加载失败 |

---

## 环境变量

| 变量 | 用途 |
|------|------|
| `WECHAT_APPID` | 微信小程序 AppID |
| `WECHAT_APPSECRET` | 微信小程序 AppSecret |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | 媒体公开域名（客户端拼公开 URL 依赖它） |
| `OSS_BUCKET` / `OSS_REGION` | 服务端上传目标 bucket |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 服务端 OSS 写入凭证（RAM 用户 `sanlin-app`） |

---

## 排查备忘

- **缺失对象返回 404**：OSS 对不存在的 key 返回 404（`NoSuchKey`），`headObject()` 对 404 / `NoSuchKey` 返回 `null`，其余错误抛出；客户端 `<img>` 的 onError 由 404 触发。
- **历史（Supabase 时期）**：对公开对象发 HEAD 请求返回 `cache-control: no-cache`、GET 才返回真实缓存头；缺失文件返回 400 而非 404。迁移到 OSS 后不再适用。
- 若需按环境隔离更严格，可将 `WECHAT_QR_ENV_VERSION` 改为读环境变量。
- 若将来需要"手动刷新二维码"，可在 Server Action 增加 `force?: boolean`，跳过 `headObject()` 直接 `putObject()` 覆盖上传（记得同样带 `cacheControl`，并在返回 URL 上加 `?v=` 让客户端绕过旧缓存）。
