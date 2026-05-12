# 微信小程序二维码功能

## 概述

在面包屑导航栏右侧提供一个二维码入口按钮。用户点击后，向下弹出一个 Popover，内含当前组织/工作空间对应的微信小程序二维码。扫码后可在微信中直接跳转至对应空间。

适用路由：`/admin`、`/manage`、`/upload-onsite`（即所有显示组织切换器的路由）。只有选中了组织后，按钮才会渲染。

---

## 文件结构

```
app/manage/actions/wechat-qr.ts      # Server Action：生成/缓存二维码
components/workspace-qr-button.tsx  # 客户端 UI：Popover + 图片
components/breadcrumb-nav.tsx        # 集成入口（在右侧渲染按钮）
components/ui/popover.tsx            # shadcn Popover 组件
locales/en.json / zh.json            # i18n 文案（workspace.qr* 键）
```

---

## 存储机制

### Supabase Storage bucket

- **Bucket 名称**：`wechat-qrcodes`
- **访问策略**：Public（直接通过 `getPublicUrl` 访问，无需鉴权）
- **允许类型**：`image/png`
- **文件大小上限**：1 MB

### 文件命名规则

```
<env_version>/<organizationId>__<workspaceId|none>.png
```

示例：

| 场景 | 路径 |
|------|------|
| 仅选中组织，无工作空间 | `develop/abc-org-id__none.png` |
| 选中组织 + 工作空间 | `develop/abc-org-id__ws-123.png` |

`env_version` 当前硬编码为 `"develop"`，定义在 `app/manage/actions/wechat-qr.ts` 的常量 `ENV_VERSION`。升级到生产时改为 `"release"` 即可，旧的 `develop/` 文件不影响使用。

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
调用方（客户端组件）
   │
   ▼
校验 organizationId 非空
   │
   ▼
构建 storagePath = "develop/<orgId>__<wsId|none>.png"
   │
   ▼
storage.download(storagePath)
   ├─ 成功（文件已存在）──▶ getPublicUrl(storagePath) → 返回 { url }
   │
   └─ 失败（文件不存在）
         │
         ▼
      getAccessToken()          ← 模块级内存缓存，60s 安全边界
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
            storage.upload(storagePath, buffer, { upsert: false })
               ├─ 成功 ──────────────────────────────────────────▶ getPublicUrl → 返回 { url }
               └─ 错误（Duplicate / Already Exists）视为成功 ──▶ getPublicUrl → 返回 { url }
```

### 微信小程序路径

```
pages/index/index?organizationId=<orgId>[&workspaceId=<wsId>]
```

`workspaceId` 为可选参数，仅在已选中工作空间时追加。

### access_token 缓存

模块级变量 `tokenCache: { token, expiresAt }`，在 token 过期前 60 秒视为无效，触发重新获取。同一 Node.js 进程实例内多次调用共享同一 token，不会重复请求 `cgi-bin/token`。

> **注意**：Serverless 环境下每次冷启动会重新获取 token，但不超过 WeChat 每日限额。

---

## 客户端组件：`WorkspaceQrButton`

文件：`components/workspace-qr-button.tsx`

### 状态管理

- 通过 `useManageStore` 读取 `selectedOrganizationId` 和 `selectedWorkspaceId`。
- 本地 `useState` 维护 `{ url, loading, error }`。
- `useEffect` 监听 `(orgId, workspaceId)` 变化 → 重置 `url` / `error`，下次打开时重新请求。

### 交互行为

| 状态 | 显示内容 |
|------|----------|
| `selectedOrganizationId` 为空 | 不渲染按钮（`return null`） |
| 首次打开 Popover | 显示 Skeleton + "生成中…" 提示 |
| 已有缓存 `url` | 直接显示图片，无网络请求 |
| 调用失败 | 显示红色错误文案 |

**Client-side 缓存机制**：`url` 存储在组件 state 中，`(org, workspace)` 不变时重复打开 Popover 不会再次调用 Server Action，实现"只调用一次 Server Action"的效果。

---

## i18n 键

`locales/en.json` 和 `locales/zh.json` 的 `workspace` 命名空间下新增：

| 键 | 英文 | 中文 |
|----|------|------|
| `workspace.qrButton` | Show QR Code | 显示二维码 |
| `workspace.qrTitle` | Scan to enter mini-program | 扫码进入小程序 |
| `workspace.qrLoading` | Generating... | 生成中… |
| `workspace.qrError` | Failed to load QR code | 二维码加载失败 |

---

## 环境变量

以下变量已存在于 `.env.local`，无需新增：

| 变量 | 用途 |
|------|------|
| `WECHAT_APPID` | 微信小程序 AppID |
| `WECHAT_APPSECRET` | 微信小程序 AppSecret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端存储操作（绕过 RLS） |

---

## 竞态安全

同一 (org, workspace) 组合同时从两个 Tab 首次请求时：

1. 两个请求都走到 `storage.download` → 均未命中。
2. 均调用 `getwxacode` 生成图片。
3. 先上传的成功；后上传的收到 "Duplicate / Already Exists" 错误 → 被视为成功，依然调用 `getPublicUrl` 返回相同 URL。
4. 用户无感知，两个 Tab 均正常显示图片。

---

## 升级生产注意事项

1. 将 `app/manage/actions/wechat-qr.ts` 中的 `ENV_VERSION` 常量改为 `"release"`。
2. 旧 `develop/` 目录下的文件不会被自动清理，可手动在 Supabase Dashboard → Storage → `wechat-qrcodes` 中删除。
3. 若需按环境隔离更严格，可改为将 `ENV_VERSION` 读取自环境变量（如 `WECHAT_ENV_VERSION`）。
4. 若将来需要支持"手动刷新二维码"，可在 Server Action 中增加 `force?: boolean` 参数，跳过 `download` 检查直接重新生成并以 `upsert: true` 覆盖上传。
