---
title: 文本资源小程序端展示样式配置
created: 2026-05-11
updated: 2026-10-09
---

# 文本资源小程序端展示样式配置

> **现状（2026-07）**：该配置已从顶层列迁入 `organization.config` jsonb
> （键 `text_asset_miniapp_style`，见迁移 `migrate_text_asset_miniapp_style_to_config`），
> 下文"数据库"一节的 DDL 与 `plain_white` 默认值仅为历史记录。
> 小程序端（xr-frame-plant-trees `components/xr-start`）通过本应用的 `GET /api/miniapp/organizations?ids=…` 读取 `config` 中的该键，
> **键缺失时的运行时默认是 `dialog_decorated`**；web 管理表单的缺省展示与之对齐
> （`components/org-settings/types.ts` 的 `DEFAULT_TEXT_ASSET_MINIAPP_STYLE`）。
> 组织 owner 也可在 `/admin/settings` 配置此项，不再仅限超管。

## 功能概述

`text_asset_miniapp_style` 是挂载在 `organization` 上的配置项，控制该组织下所有 `text` 类型资源在**微信小程序端**的 UI 表现形式。超级管理员在 `/super-admin/organizations` 的组织详情面板、组织 owner 在 `/admin/settings` 中通过下拉框配置（两处共用 `components/org-settings/OrgSettingsForm.tsx`）。

---

## 数据库

### 字段定义

```sql
ALTER TABLE organization
ADD COLUMN text_asset_miniapp_style TEXT NOT NULL DEFAULT 'plain_white'
CHECK (text_asset_miniapp_style IN ('plain_white', 'dialog_decorated'));
```

| 属性 | 值 |
|---|---|
| 表 | `public.organization` |
| 类型 | `TEXT` |
| 默认值 | `plain_white` |
| 约束 | `CHECK` — 仅允许枚举值，新样式需同步更新约束 |

### 枚举值

| 值 | 展示效果 |
|---|---|
| `plain_white` | 纯白文本，无额外装饰 |
| `dialog_decorated` | 对话框气泡样式 |

> 后续新增样式时，需先执行 DDL 更新 CHECK 约束，再扩展前端。

---

## 类型定义

**`app/manage/types.ts`**

```ts
export type TextAssetMiniappStyle = "plain_white" | "dialog_decorated";

export interface Organization {
  // ...
  text_asset_miniapp_style?: TextAssetMiniappStyle;
}
```

`TextAssetMiniappStyle` 为字符串字面量联合类型，与数据库 CHECK 约束保持一致，是扩展新样式的唯一 TS 入口。

---

## API

> 两条写入路径都对该键做白名单校验：`/admin/settings` 走 `PUT /api/organizations/[id]`（随 `config` 一并提交，`app/api/organizations/[id]/route.ts`），超级管理员走 Server Action `updateOrganization`（见下节）。

### Server Action `updateOrganization`（`app/super-admin/organizations/actions.ts`）

```ts
const VALID_MINIAPP_STYLES = ["plain_white", "dialog_decorated"] as const;

// payload.config 中包含 text_asset_miniapp_style 时做白名单校验
const safeConfig = { ...safePayload.config };
if (
  safeConfig.text_asset_miniapp_style !== undefined &&
  !VALID_MINIAPP_STYLES.includes(safeConfig.text_asset_miniapp_style)
) {
  delete safeConfig.text_asset_miniapp_style;
}
```

- 仅 `super_admin` 全局角色可调用（`requireSuperAdmin()` 守卫）。
- 值不合法时静默丢弃（键位于 jsonb `config` 中，已无数据库 CHECK 约束）。

---

## 前端入口

### 共享组织设置表单（`components/org-settings/`）

超级管理员的组织详情面板（`app/super-admin/organizations/components/OrgDetailPanel.tsx`）和组织设置页（`app/admin/settings/page.tsx`，仅 owner / super_admin）都渲染同一个 `OrgSettingsForm`：

- **UI 控件**：`components/org-settings/TextAssetStyleSection.tsx`，ShadcnUI `<Select>`，i18n key 位于 `superAdmin.orgs.textAsset.*`。
- **状态**：`components/org-settings/useOrgSettingsForm.ts` 从 `org.config?.text_asset_miniapp_style` 初始化，缺省为 `DEFAULT_TEXT_ASSET_MINIAPP_STYLE`（`components/org-settings/types.ts`，值为 `dialog_decorated`，与小程序端回退一致）；`hasChanged` 检查中包含此字段。
- **保存**：随 `config` 一并提交——超级管理员面板走 Server Action `updateOrganization`，`/admin/settings` 走 `PUT /api/organizations/[id]`。

---

## 国际化

所有 key 位于 `superAdmin.orgs.*` 命名空间（已从 `admin.settings.*` 迁移）。

**`locales/zh.json`**

```json
"section": {
  "textAssetStyle": "文本资源样式（小程序端）"
},
"textAsset": {
  "styleDesc": "控制文本类型资源在微信小程序中的展示形式",
  "plain_white": "纯白文本",
  "dialog_decorated": "对话框装饰"
}
```

**`locales/en.json`**

```json
"section": {
  "textAssetStyle": "Text Asset Style (Mini Program)"
},
"textAsset": {
  "styleDesc": "Controls how text-type assets are displayed in the WeChat Mini Program",
  "plain_white": "Plain White Text",
  "dialog_decorated": "Dialog Decorated"
}
```

---

## 小程序端消费方式

小程序（`xr-frame-plant-trees`，渲染器已于 2026-10-09 迁移到 VisionKit + Three.js，见该仓库 `docs/visionkit-three-migration.md`）在 `components/xr-start/index.js` 中通过 `GET /api/miniapp/organizations` 读取 `config.text_asset_miniapp_style`（缺失时回退 `dialog_decorated`），渲染文本资源时交给 `lib/three-runtime/text.js` 的 `createTextAsset(text, config, style)`：文字在离屏 canvas 上绘制成纹理，气泡完全程序化生成，不再依赖气泡 / 头像位图。

```
text_asset_miniapp_style
  ├── "plain_white"       → 纯白文字，无背景
  └── "dialog_decorated"  → 文字 + 圆角气泡背景（默认）
```

---

## 扩展新样式

1. **数据库**：无需 DDL（键位于 jsonb `organization.config`）。
2. **类型**：在 `TextAssetMiniappStyle`（`app/manage/types.ts`）中追加新值。
3. **写入校验**：在 `VALID_MINIAPP_STYLES`（`app/super-admin/organizations/actions.ts`）和 `app/api/organizations/[id]/route.ts` 的白名单中追加新值。
4. **前端**：在 `components/org-settings/TextAssetStyleSection.tsx` 的 `<SelectContent>` 中新增 `<SelectItem>`。
5. **i18n**：在 `superAdmin.orgs.textAsset` 下新增对应 key。
6. **小程序**：在 `lib/three-runtime/text.js` 的 `createTextAsset` 中增加对应分支。
