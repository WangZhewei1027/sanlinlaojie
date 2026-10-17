# 权限体系说明

权限由全局角色和团队（组织）角色决定。团队是唯一的所有权与权限边界：团队成员共享全部素材、场景、地图合集和投放。`lib/permissions.ts` 提供可在客户端使用的纯规则，`lib/content-model/access.server.ts` 负责服务端查库、范围检查与能力计算。团队的内容模型状态另行控制是否允许写入，见 [数据层](data-layer.md)。UI 隐藏按钮不是鉴权边界。完整的服务端规则与路由见 [团队工作台后端契约](team-workbench-backend-contract.md)，前端表达见 [团队工作台](team-workbench.md)。

## 内容模型 V2 的权限边界（团队模型）

| 操作 | 条件 |
| --- | --- |
| 浏览素材、场景、合集、投放 | 团队任一成员（owner/admin/member/viewer）；非本团队的 ID 返回 404 |
| 上传素材、新版本、重命名、归档素材 | 团队 owner/admin/member，团队未归档，并通过迁移写入门禁；不再要求维护者 |
| 新建/编辑/发布/复制场景 | 同上；不需要任何合集 |
| 新建、编辑、归档地图合集；管理投放 | 同上；已归档合集的投放只读 |
| 把素材版本或场景发布版本放进合集 | 同团队即可，任意未归档合集；已归档素材/场景不能新增引用 |
| 转交维护人（`maintainedBy`） | 团队 owner/admin；维护人只是信息，不限制编辑 |
| 成员与团队角色、团队设置 | 见下文组织角色矩阵 |

`workspace_assignment`、`asset_workspace_grant` 与素材 `visibility` 只作历史和元数据保留，不参与权限；项目授权、项目成员和成员分配的写接口返回 410 `DEPRECATED`。`origin_workspace_id` 是来源，`created_by` 是审计，OSS 目录是存储路径，均不能替代所有权。

投放内容预览走 `GET /api/placements/[id]/content`，只返回该投放固定的版本。旧 scope 里的共享投放在非来源合集只读。

归档不删除引用：素材已有引用继续工作，Scene 已有投放继续播放；合集归档后其投放停止展示并变为只读，团队素材与场景不受影响。团队归档停止该团队公开入口与写入。

当前 OSS 使用公开 URL；团队范围保护目录和 API，不承诺文件字节保密。匿名小程序只能取得启用投放的运行清单，不能借公开 ID 访问管理目录或草稿。

> 以下第一至八节记录角色字段与矩阵。其中涉及项目 assignment、项目 manager 的描述属于旧模型，现仅作历史数据说明：团队模型的服务端规则适用于所有团队，分配类写接口返回 410。

---

## 一、数据库字段

### `public.users.role`
全局角色字段，PostgreSQL 枚举类型 `user_role`。

| 值 | 含义 | 默认值 |
|---|---|---|
| `user` | 普通用户，权限受第二层组织角色控制 | ✅ |
| `super_admin` | 超级管理员，拥有全系统最高权限 | — |

```sql
-- 枚举定义
CREATE TYPE user_role AS ENUM ('super_admin', 'user');

-- 表字段
users.role  user_role  DEFAULT 'user'
```

---

### `public.organization_member.role`
组织角色字段，`text` 类型，带 CHECK 约束。

| 值 | 含义 | 默认值 |
|---|---|---|
| `owner` | 拥有者，组织内最高权限 | — |
| `admin` | 管理员，可管理成员和工作区，但不能操作拥有者 | — |
| `member` | 普通成员，可编辑团队全部内容与合集 | ✅ |
| `viewer` | 访客，只读浏览团队内容 | — |

```sql
-- CHECK 约束
organization_member.role  text  DEFAULT 'member'
  CHECK (role = ANY (ARRAY['owner', 'admin', 'member', 'viewer']))
```

---

### `public.workspace_assignment.role`（历史）
团队模型下不再参与权限，`WorkspaceDto.project_role` 由团队角色推导（owner/admin → manager，member → editor，viewer → viewer）。以下为旧模型说明：项目角色为 `manager/editor/viewer`，默认 editor，唯一约束为 `(workspace_id,user_id)`。owner/admin 在本组织所有项目隐式为 manager；组织 viewer 即使存在 editor assignment 也被限制为 viewer。member 无 assignment 时没有项目权限。

manager 可向已有组织成员授 editor/viewer，不能提升组织角色或授其他 manager；owner/admin 可分配 manager。旧 `role='member'` 曾是惰性字段，迁移依据组织角色和有效 assignment 映射，不能把历史异常角色或旧宽松 API 的访问范围自动升级为编辑权。邀请、成员分配与批量注册使用相同的默认规则：项目角色默认 editor，组织 viewer 限制为 viewer；新接口不再写入项目 member 角色。

---

## 二、组织角色权限矩阵

> 来源：`lib/permissions.ts` → `ORG_PERMISSION_MATRIX`

| 权限键 | 说明 | owner | admin | member | viewer |
|---|---|:---:|:---:|:---:|:---:|
| `org.view` | 进入组织管理后台 | ✅ | ✅ | ✅ | ✅ |
| `org.settings` | 修改组织设置（名称、描述、地图中心等） | ✅ | ❌ | ❌ | ❌ |
| `org.delete` | 删除整个组织 | ✅ | ❌ | ❌ | ❌ |
| `org.members.view` | 查看成员列表 | ✅ | ✅ | ✅ | ❌ |
| `org.members.add` | 邀请新成员 | ✅ | ✅ | ❌ | ❌ |
| `org.members.remove` | 移除成员 | ✅ | ✅ | ❌ | ❌ |
| `org.members.changeRole` | 修改成员角色 | ✅ | ✅ | ❌ | ❌ |
| `org.members.manageOwners` | 添加/修改拥有者角色 | ✅ | ❌ | ❌ | ❌ |
| `org.workspaces.view` | 查看工作区列表 | ✅ | ✅ | ✅ | ✅ |
| `org.workspaces.create` | 创建工作区 | ✅ | ✅ | ❌ | ❌ |
| `org.workspaces.edit` | 编辑工作区 / 给成员分配 workspace | ✅ | ✅ | ❌ | ❌ |
| `org.workspaces.delete` | 删除工作区 | ✅ | ✅ | ❌ | ❌ |
| `org.assets.write` | 团队内容写入（素材、场景、投放） | ✅ | ✅ | ✅ | ❌ |
| `org.collections.manage` | 新建、编辑、归档地图合集 | ✅ | ✅ | ✅ | ❌ |

组织矩阵继续用于团队设置、邀请和管理后台，并作为前端界面开关（`teamCanWrite()`）。服务端内容命令仍经 `access.server.ts` 校验团队成员身份、团队/合集归档状态与迁移门禁。旧组织管理型 `/api/users/[id]/workspaces` 与项目成员管理入口职责不同，不能通过复用旧路由扩大 manager 的组织权限。

---

## 三、全局角色权限矩阵

> 来源：`lib/permissions.ts` → `GLOBAL_PERMISSION_MATRIX`

| 权限键 | 说明 | super_admin | user |
|---|---|:---:|:---:|
| `global.users.view` | 查看全部用户列表 | ✅ | ❌ |
| `global.users.changeRole` | 修改任意用户全局角色 | ✅ | ❌ |
| `global.organizations.create` | 创建新组织 | ✅ | ❌ |
| `global.organizations.viewAll` | 查看所有组织 | ✅ | ❌ |

`super_admin` 在所有组织内也自动绕过组织角色限制，相当于每个组织的隐式 owner。

---

## 四、侧边栏可见性

> 来源：`lib/permissions.ts` → `SIDEBAR_VISIBILITY`

| 路由 | 所需权限 | 可见角色 |
|---|---|---|
| `/admin` | `org.view` | owner / admin / member / viewer |
| `/admin/settings` | `org.settings` | owner |
| `/admin/members` | `org.members.view` | owner / admin / member |
| `/admin/workspaces` | `org.workspaces.view` | owner / admin / member / viewer |

`super_admin` 始终可见所有菜单项。v2 团队的 `/admin/workspaces` 跳转到 `/manage/collections`；主导航的“团队设置”只在可见成员或设置页时显示。

---

## 五、API 层额外约束

以下规则在 `app/api/organizations/[id]/members/route.ts` 中硬编码，独立于权限矩阵之外：

### 添加成员（POST）
- `admin` 拥有 `org.members.add`，可邀请新成员。
- 但目标角色为 `owner` 时，**必须是 owner 或 super_admin** 才能操作。

### 修改成员角色（PATCH）
- `admin` 拥有 `org.members.changeRole`，可修改 admin / member / viewer 的角色。
- **不能修改 `owner` 的角色**（`targetMember.role === 'owner'` 时拒绝，除非操作者是 owner 或 super_admin）。
- **不能将角色改为 `owner`**（除非操作者是 owner 或 super_admin）。

### 移除成员（DELETE）
- `admin` 拥有 `org.members.remove`，可移除 admin / member / viewer。
- **不能移除 `owner`**（除非操作者是 owner 或 super_admin）。

---

## 六、角色关系总结

```
super_admin (users.role)
  └── 绕过所有组织权限，隐式 owner

organization_member.role
  ├── owner        → 全部权限，唯一可管理其他 owner
  ├── admin        → 成员管理 + 团队内容；见本团队全部合集
  ├── member       → 读写团队全部内容与合集
  └── viewer       → 纯只读（可看团队全部内容，不可写）
```

---

## 八、注册与邀请

### 注册自动建团队
新用户注册（`auth.users` insert）由触发器 `handle_new_user()` 自动：建 `users` 行（`role='user'`）
→ 建一个个人 `organization`（本人 `created_by`，`content_model_state='v2'`）→ 将其设为 `owner`。
三步原子，不创建默认合集；素材与场景可直接创建，地图合集按需创建。管理接口新建团队同样直接使用 v2。
已有团队的迁移状态保持不变，数据库列默认值仍为 legacy，避免影响旧数据导入与迁移流程。

### 邀请机制（`organization_invitation`）
- owner/admin（`org.members.add`）可「生成邀请链接」或「搜索用户直接添加」。
- 链接可带可选 `workspace_id`，角色仅限 `admin/member/viewer`（**不可授 owner**，防链接泄露提权）。
- 接受邀请（`/invite/[token]`，自动同意）：写入 `organization_member`，幂等（`on conflict do nothing`）。
  链接中的 `workspace_id` 只用于接受后跳转，不再创建 `workspace_assignment`。
- 未登录访问邀请链接 → 跳 `/auth/login?next=/invite/token`，登录后回跳接受。
- 相关：`app/api/organizations/[id]/invitations`、`app/api/invitations/[token]`、
  `app/api/users/search`（org 范围用户搜索，替代 super_admin 专属 `/api/users`）。

### 统一错误与日志
写操作经 `lib/fetch-json.ts` 统一弹 toast（sonner）；服务端 `lib/log-error.ts` 把 4xx/5xx
写入 `public.error_log`（fire-and-forget）。

---

## 七、代码入口

| 文件 | 说明 |
|---|---|
| [lib/permissions.ts](../lib/permissions.ts) | 权限矩阵定义、辅助函数（`hasOrgPermission`、`isSuperAdmin`、`isSidebarItemVisible`） |
| [lib/permissions.server.ts](../lib/permissions.server.ts) | 服务端共享：`getUserContext`、`getWorkspaceOrgId(s)` |
| [lib/content-model/access.server.ts](../lib/content-model/access.server.ts) | 项目与素材授权、capabilities、迁移写入门禁 |
| [lib/content-model/contracts.ts](../lib/content-model/contracts.ts) | 项目角色、请求/响应、错误码契约 |
| [app/api/organizations/\[id\]/members/route.ts](../app/api/organizations/%5Bid%5D/members/route.ts) | 成员 CRUD API，含 owner 保护逻辑 |
| [app/api/organizations/\[id\]/invitations/route.ts](../app/api/organizations/%5Bid%5D/invitations/route.ts) | 邀请链接 CRUD |
| [app/api/invitations/\[token\]/route.ts](../app/api/invitations/%5Btoken%5D/route.ts) | 邀请预览 / 接受（自动同意） |
| [db/schema.sql](../db/schema.sql) | 基线结构：`handle_new_user` 自动建 org+默认 workspace / `organization_invitation` / 唯一约束 / `get_user_workspaces` admin 可见性 / `error_log`（原 `supabase/migrations/` 增量已并入） |
| [app/admin/layout.tsx](../app/admin/layout.tsx) | 侧边栏按角色动态过滤 |
| [app/super-admin/layout.tsx](../app/super-admin/layout.tsx) | 超级管理员入口，启动时校验 `users.role` |
