# 权限体系说明

权限由全局角色、组织角色、项目角色和素材授权共同决定。`lib/permissions.ts` 提供可在客户端使用的纯规则，`lib/content-model/access.server.ts` 负责服务端查库、范围检查与能力计算。组织内容模型状态另行控制是否允许写入，见 [数据层](data-layer.md)。UI 隐藏按钮不是鉴权边界。

## 内容模型 V2 的权限边界

| 操作 | 条件 |
| --- | --- |
| 浏览项目 | 组织 owner/admin 隐式可读；member/viewer 需要有效项目 assignment |
| 上传、保存场景、发布、管理自有投放 | 项目 editor/manager，组织角色可写，项目与组织未归档，并通过迁移写入门禁 |
| 使用素材 | 素材与目标项目同组织；已有项目 grant，或通过组织共享/维护权在事务中建立 grant |
| 修改素材身份、上传新版本、归档 | `maintained_by` 且组织可写，或组织 owner/admin；使用素材不自动取得维护权 |
| 转交素材维护者 | 组织 owner/admin；目标为有效可写组织成员 |
| 共享改 restricted | 停止新项目自由选用，保留已有 grant |
| 撤销项目 grant | 与新增引用使用相同的锁；有草稿、保留发布或直接投放依赖时返回 409 |
| 查看使用记录 | 显示可访问的项目/场景，其余只提供受限计数 |

`origin_workspace_id` 是来源，`created_by` 是审计，OSS 目录是存储路径，均不能替代所有权或 ACL。素材 `visibility=restricted` 的可读路径是维护者、管理员或获授权项目；`organization` 允许同组织成员浏览。

跨项目投放固定 SceneRevision 时，首次使用或切换版本检查来源项目发布权及目标项目编辑权；移动、暂停、归档只需目标项目权限。目标项目不会因此获得源草稿或素材目录访问权。复制为可编辑 Scene 时逐项检查素材授权。旧 scope 里的共享投放在非来源项目只读。

投放内容预览走 `GET /api/placements/[id]/content`，只返回该投放固定的版本。共享 scope 可预览不等于可查看源素材历史、升级源版本或新建复用授权；显式 viewer 项目必须与投放拥有有效关联。按 hash 查文件也校验来源使用权，并仅允许复用调用者自己的未过期上传回执。

归档不删除引用：素材已有引用继续工作，Scene 已有投放继续播放；项目归档禁止写入并停止其自有投放，其他活动项目独立拥有的投放可继续使用固定发布版本。组织归档停止该组织公开入口与写入。

当前 OSS 使用公开 URL；项目私有范围保护目录和 API，不承诺文件字节保密。匿名小程序只能取得启用投放的运行清单，不能借公开 ID 访问管理目录或草稿。

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
| `member` | 普通成员，项目权限由 assignment 决定，源素材维护权另行判断 | ✅ |
| `viewer` | 访客，仅可查看工作区 | — |

```sql
-- CHECK 约束
organization_member.role  text  DEFAULT 'member'
  CHECK (role = ANY (ARRAY['owner', 'admin', 'member', 'viewer']))
```

---

### `public.workspace_assignment.role`
项目角色为 `manager/editor/viewer`，默认 editor，唯一约束为 `(workspace_id,user_id)`。owner/admin 在本组织所有项目隐式为 manager；组织 viewer 即使存在 editor assignment 也被限制为 viewer。member 无 assignment 时没有项目权限。

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
| `org.assets.write` | 组织角色允许内容写入的上限；仍需项目/素材授权 | ✅ | ✅ | ✅ | ❌ |

组织矩阵继续用于组织设置、邀请和管理后台。内容服务还必须调用项目/素材授权；不得只凭 `org.assets.write` 放行 Asset 或 Scene。旧组织管理型 `/api/users/[id]/workspaces` 与项目成员管理入口职责不同，不能通过复用旧路由扩大 manager 的组织权限。

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

`super_admin` 始终可见所有菜单项。

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
  ├── owner        → 全部权限，唯一可管理其他 owner；见本 org 全部 workspace
  ├── admin        → 成员管理 + 项目管理 + 素材管理；见本 org 全部 workspace
  ├── member       → 按项目 assignment 读写；源素材维护权单独判断
  └── viewer       → 纯只读（可看被分配 workspace 的内容，但不可写任何资产）
```

---

## 八、注册与邀请

### 注册自动建组织
新用户注册（`auth.users` insert）由触发器 `handle_new_user()` 自动：建 `users` 行（`role='user'`）
→ 建一个个人 `organization`（本人 `created_by`）→ 将其设为 `owner` → 建一个「默认工作区」。
四步原子。

### 邀请机制（`organization_invitation`）
- owner/admin（`org.members.add`）可「生成邀请链接」或「搜索用户直接添加」。
- 链接可带可选 `workspace_id`，角色仅限 `admin/member/viewer`（**不可授 owner**，防链接泄露提权）。
- 接受邀请（`/invite/[token]`，自动同意）：**先写 `organization_member`（org 强制前置）**，
  若带 workspace 再写 `workspace_assignment`；均幂等（`on conflict do nothing`）。
- 项目 assignment 按接受后的实际组织成员角色生成：默认 editor，组织 viewer 为 viewer。已有组织成员或项目 assignment 不因接受邀请而覆盖升级。
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
