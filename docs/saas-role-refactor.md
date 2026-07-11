# SaaS 化角色/账号体系改造说明（2026-07）

本次把账号权限体系向常规 SaaS（如 Supabase）靠拢，并补齐了一套错误处理与观测基建。本文档说明**所有新机制**及其入口。权限矩阵的角色对照见 [permissions.md](./permissions.md)，本文侧重「新增了什么、怎么工作」。

---

## 1. 注册即自有组织（auto-org）

新用户注册后，DB 触发器 `handle_new_user()`（`AFTER INSERT ON auth.users`, SECURITY DEFINER）**原子地**完成四步：

1. 插入 `public.users`（`role='user'`）；
2. 建个人 `organization`，名称 `X's Organization`（X = `raw_user_meta_data.name`，无名则取邮箱 `@` 前缀），`created_by = 新用户`；
3. 将其加入 `organization_member`，`role='owner'`；
4. 建一个默认 workspace `Default Workspace`。

任一步失败则整个注册回滚（不会留半状态）。名称用英文（迁移 `*_english_default_org_names.sql`）。

- 迁移：`*_auto_org_on_signup.sql` → `*_english_default_org_names.sql`
- 存量用户**不回填**（触发器只对新注册生效）。

---

## 2. 邀请机制

### 数据模型
`public.organization_invitation`：
```
id, organization_id, workspace_id?(可空), token(unique), role, created_by,
created_at, expires_at?(可空=永不过期), revoked(bool), use_count
```

### 原理：不透明令牌 + 服务端查表（capability token）
邀请链接是 `${origin}/invite/${token}`，`token` 是随机 UUID，**本身不含任何信息**。org/role/workspace 都存在 DB 行里，按 token 反查。**角色不放 URL 参数**——否则被邀请者改 URL 就能提权。

### 接口
- `POST /api/organizations/[id]/invitations` — 创建，body `{ role?, workspace_id?, expires_at? }`，返回 `token`。权限 `org.members.add`。
  - `role` 仅允许 `admin/member/viewer`；**`owner` 直接 400**（可复用+自动同意的链接不得授 owner，防泄露提权）。
  - 带 `workspace_id` 时校验其属于本 org。
- `GET /api/organizations/[id]/invitations` — 列出未撤销邀请。
- `DELETE …?invitation_id=` — 撤销（软删，`revoked=true`）。
- `GET /api/invitations/[token]` — 预览（org 名/role/是否有效），不写库。
- `POST /api/invitations/[token]` — **接受（自动同意）**：`getUser()` → 校验 token（`revoked`、`expires_at` 都查）→ **① 先写 `organization_member`（org 强制前置）** → **② 若带 workspace 再写 `workspace_assignment`** → `use_count+1`。均幂等（`on conflict do nothing`）。
- `GET /api/users/search?organization_id=&q=` — org 范围用户搜索（供「搜索用户直接添加」），替代 super_admin 专属的 `/api/users`。查询用**邮箱精确或 ≥3 字符前缀**、限 20 条，降低用户枚举面。

### 核心不变量
接受邀请**永远先入 org 再分配 workspace**，`workspace_id` 必属邀请对应 org（创建+接受双校验）。系统里不会出现「有 workspace 分配却不是父 org 成员」的孤儿态。

### 前端
- 页面 `app/invite/[token]/`（服务端 `page.tsx` + 客户端 `InviteClient.tsx`）：未登录 → 跳 `/auth/login?next=/invite/${token}`；已登录 → 自动接受并跳 `/manage`。
- 弹窗 `app/admin/members/components/InviteLinkDialog.tsx`：选角色 + 可选 workspace + **有效期**（1/7/30 天/永不），生成链接。**链接用 `window.location.origin` 在客户端拼**（不依赖服务端 `request.url`，避免代理/非默认端口下拿到内部地址）。改任一参数会清空已生成链接，避免参数与链接不一致。
- proxy 放行 `/invite` 与 `/api/errors`；登录/注册的 `next` 跳转经 `lib/safe-next.ts` 校验为站内相对路径（防开放重定向）。

- 迁移：`*_organization_invitation.sql`、`*_membership_unique_constraints.sql`

---

## 3. 角色/权限调整（保留四角色结构）

矩阵真源仍是 `lib/permissions.ts`。本次：

- **新增权限键 `org.assets.write`**（owner/admin/member ✓，**viewer ✗**）。
- **workspace 管理权对齐矩阵**：创建/编辑/删除 workspace、给成员分配 workspace，从「super_admin 专属」放开给 owner/admin（`org.workspaces.*`）。修掉两条旧 bug：owner 改不了自己 org 的 workspace；viewer 能创建 workspace。
- **admin 可见本 org 全部 workspace**：`get_user_workspaces` 的「见全部」条件从 `role='owner'` 扩到 `role IN ('owner','admin')`；member/viewer 仍只见被分配的（`workspace_assignment` 行决定可见性，`role` 列惰性不参与鉴权）。
- **viewer 纯只读**：不能创建/编辑/删除**资产**。

服务端鉴权统一走共享 helper `lib/permissions.server.ts` 的 `getUserContext(supabase,userId,orgId)`、`getWorkspaceOrgId(s)`。

- 迁移：`*_admin_workspace_visibility.sql`

---

## 4. 资产写入服务端化（viewer 只读的落点）

资产**创建**原来是前端直连 Supabase 插入，app 层拦不住。现改为：

- 新增 `POST /api/workspaces/[id]/assets`（带 `org.assets.write` 校验），承接原 `lib/upload/service.ts` 的 4 类载荷（file/link/text/anchor）；文件仍客户端上传，只把 DB 写入移到服务端。
- `PATCH/DELETE /api/assets/[id]` 补角色校验：由 asset 的 `workspace_id`（数组，可跨多 workspace/org）解析出所有 org，要求对**每一个** org 都有 `org.assets.write`（最严，防跨 org 资产绕权）。
- UI：`ManageSidebar`（manage 页）与 `upload-onsite` 对 viewer 隐藏上传/编辑/删除入口（真正拦截靠服务端）。

> 说明：本阶段**未启用 RLS**，以上均为 app 层判定（匿名直连 DB 理论可绕过，与其它权限同一姿态，后续用 RLS 收口）。

---

## 5. 统一错误处理与观测

### 客户端：`lib/fetch-json.ts`
写操作统一走 `fetchJson()`：非 2xx 弹 sonner toast（显示后端 `error`）并抛 `ApiError`；网络错误额外上报 `/api/errors`。全局 `<Toaster>` 挂在 `app/layout.tsx`（`components/ui/sonner.tsx`）。

### 全局崩溃捕获
- `components/error-reporter.tsx`：监听 `window.error` 与 `unhandledrejection`，上报 `/api/errors`（会话内去重，防刷屏）。挂在根布局。
- `app/global-error.tsx`：根级 React Error Boundary，捕获渲染崩溃、上报并给「重试」。
- 说明：**不** hook `console.error`（抛出的错误已被 `window.error` 抓到，重复 hook 会双报+噪声）。

### 服务端：`lib/log-error.ts` + `public.error_log`
- `logError(supabase, entry)` / `logErrorSafe(entry)`（后者自建 client，可在 catch 里直接用）。**fire-and-forget，永不抛错**。
- 所有 API 路由的 catch(500) 与权限拒绝(403) 前调用，写 `error_log`（`scope='api'`）。
- `POST /api/errors`：客户端错误 sink，写 `scope='client'`。**不强制登录**（登录记 `user_id`，否则 null），以覆盖公开页崩溃；字段白名单+截断。

### error_log 表
```
id, created_at, user_id?, scope('api'|'client'), method, path, status, message, context(jsonb)
```
仅记 4xx/5xx。索引 `created_at desc`、`status`。运维可定期清理。

- 迁移：`*_error_log.sql`

---

## 6. UI 权限一致性

不出现「看得到却不能用」的控件：

- `/admin/workspaces`：创建/编辑/删除按钮按 `org.workspaces.*` 渲染，member/viewer 只留只读列表。
- `/admin/settings`：save/删除按 `org.settings`/`org.delete` gate + 页面级 guard（非 owner 深链看到「无权限」提示）。
- 成员页 `ManageWorkspaceDialog` 入口对有 `org.workspaces.edit` 的 owner/admin 可见。
- 无权限动作一律走统一 toast，不再有静默失败或 `alert()`。

---

## 7. 修复：删除用户 500

删除 auth 用户曾报 `null value in column "created_by" of relation "asset" violates not-null constraint`。根因是**外键删除规则与列可空性矛盾**：

- `asset.created_by` 是 `NOT NULL`，但 FK 为 `ON DELETE SET NULL` → 删用户时置 NULL 撞约束。**修复：列改可空**。
- `organization.created_by` FK 为 `NO ACTION` → 删「建过 org 的用户」被阻断（auto-org 后人人建 org）。**修复：改 `ON DELETE SET NULL`**。

删除语义：用户的资产/组织**保留**（created_by 置空），成员关系与 workspace 分配随之级联删除。

- 迁移：`*_fix_user_deletion_fks.sql`

---

## 8. i18n

`/admin/members`、邀请弹窗、settings 无权限提示、upload-onsite 只读提示等新增文案的 key 已补进 `locales/en.json` 与 `zh.json`（默认 `zh`，`fallbackLng: en`）。

---

## 迁移清单（`supabase/migrations/`，均已 apply 到远端）

| 文件 | 作用 |
|---|---|
| `*_auto_org_on_signup.sql` | 注册自动建 org+owner+默认 workspace |
| `*_organization_invitation.sql` | 邀请表 |
| `*_membership_unique_constraints.sql` | `organization_member`/`workspace_assignment` 唯一约束（幂等兜底） |
| `*_admin_workspace_visibility.sql` | admin 可见本 org 全部 workspace |
| `*_error_log.sql` | 错误日志表 |
| `*_fix_user_deletion_fks.sql` | 修删除用户 500（asset/org 的 FK 规则） |
| `*_english_default_org_names.sql` | 默认 org/workspace 用英文名 |

## 关键新增/改动文件

**新增**：`lib/permissions.server.ts`、`lib/fetch-json.ts`、`lib/log-error.ts`、`lib/safe-next.ts`、`components/ui/sonner.tsx`、`components/error-reporter.tsx`、`app/global-error.tsx`、`app/invite/[token]/*`、`app/admin/members/components/InviteLinkDialog.tsx`、`app/api/organizations/[id]/invitations/route.ts`、`app/api/invitations/[token]/route.ts`、`app/api/users/search/route.ts`、`app/api/errors/route.ts`。

**改动**：`lib/permissions.ts`（+`org.assets.write`）、`lib/supabase/proxy.ts`（放行 `/invite`、`/api/errors`）、`lib/upload/service.ts`（改走服务端创建资产）、各 org/workspace/asset 相关 API 路由（矩阵鉴权 + `logError`）、各写操作组件（改走 `fetchJson`）、`app/layout.tsx`（Toaster + ErrorReporter + Suspense）。

## 本阶段未做（后续）
- **RLS 仍关闭**：所有鉴权在 app 层，匿名直连 DB 可绕过——最需要后续用 RLS 收口。
- 存量用户不回填个人 org；super-admin「查看所有组织」将随用户数线性膨胀（后续加分页/搜索）。
