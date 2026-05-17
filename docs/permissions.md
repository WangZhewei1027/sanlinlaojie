# 权限体系说明

本项目采用**两层权限模型**：第一层为全局角色（Global Role），决定用户能否访问超级管理员功能；第二层为组织角色（Org Role），决定用户在具体组织内的操作权限。

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
| `member` | 普通成员，只读访问 | ✅ |
| `viewer` | 访客，仅可查看工作区 | — |

```sql
-- CHECK 约束
organization_member.role  text  DEFAULT 'member'
  CHECK (role = ANY (ARRAY['owner', 'admin', 'member', 'viewer']))
```

---

### `public.workspace_assignment.role`
工作区分配角色，`text` 类型，默认 `member`（目前作为预留字段，实际访问控制由组织角色决定）。

```sql
workspace_assignment.role  text  DEFAULT 'member'
```

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
| `org.workspaces.edit` | 编辑工作区信息 | ✅ | ✅ | ❌ | ❌ |
| `org.workspaces.delete` | 删除工作区 | ✅ | ✅ | ❌ | ❌ |
| `org.cleanup` | 废弃素材清理 | ✅ | ✅ | ❌ | ❌ |

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
| `/admin` | `org.view` | owner / admin / member |
| `/admin/settings` | `org.settings` | owner |
| `/admin/members` | `org.members.view` | owner / admin / member |
| `/admin/workspaces` | `org.workspaces.view` | owner / admin / member / viewer |
| `/admin/clean` | `org.cleanup` | owner / admin |

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
  ├── owner        → 全部权限，唯一可管理其他 owner
  ├── admin        → 成员管理 + 工作区管理 + 清理（不涉及 owner 操作）
  ├── member       → 只读（查看成员列表 + 查看工作区）
  └── viewer       → 最小只读（仅查看工作区）
```

---

## 七、代码入口

| 文件 | 说明 |
|---|---|
| [lib/permissions.ts](../lib/permissions.ts) | 权限矩阵定义、辅助函数（`hasOrgPermission`、`isSuperAdmin`、`isSidebarItemVisible`） |
| [app/api/organizations/\[id\]/members/route.ts](../app/api/organizations/%5Bid%5D/members/route.ts) | 成员 CRUD API，含 owner 保护逻辑 |
| [app/admin/layout.tsx](../app/admin/layout.tsx) | 侧边栏按角色动态过滤 |
| [app/super-admin/layout.tsx](../app/super-admin/layout.tsx) | 超级管理员入口，启动时校验 `users.role` |
