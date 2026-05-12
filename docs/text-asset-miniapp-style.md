---
title: 文本资源小程序端展示样式配置
created: 2026-05-11
updated: 2026-05-11
---

# 文本资源小程序端展示样式配置

## 功能概述

`text_asset_miniapp_style` 是挂载在 `organization` 上的配置项，控制该组织下所有 `text` 类型资源在**微信小程序端**的 UI 表现形式。**超级管理员**在 `/super-admin/organizations` 的组织详情面板中通过下拉框配置，普通组织管理员不可见。

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

> 该字段不再经过 `/api/organizations/[id]` 路由修改。超级管理员通过 Server Action 直接写库（见下节），普通组织管理员无权操作此字段。

### Server Action `updateOrganization`（`app/super-admin/organizations/actions.ts`）

```ts
const VALID_MINIAPP_STYLES = ["plain_white", "dialog_decorated"] as const;

// payload 中包含 text_asset_miniapp_style 时做白名单校验
if (
  payload.text_asset_miniapp_style !== undefined &&
  !VALID_MINIAPP_STYLES.includes(payload.text_asset_miniapp_style)
) {
  delete safePayload.text_asset_miniapp_style;
}
```

- 仅 `super_admin` 全局角色可调用（`requireSuperAdmin()` 守卫）。
- 值不合法时静默丢弃，数据库 CHECK 约束是最终防线。

---

## 前端入口

### 超级管理员面板（`app/super-admin/organizations/components/OrgDetailPanel.tsx`）

配置入口迁移至超级管理员的组织详情面板，位于「文件类型」区块之后，保存按钮之前。

**相关类型**

`OrgData`（`app/super-admin/organizations/types.ts`）中新增：

```ts
text_asset_miniapp_style?: string;
```

**状态初始化**

```ts
const [textAssetMiniappStyle, setTextAssetMiniappStyle] =
  useState<TextAssetMiniappStyle>(
    (org.text_asset_miniapp_style as TextAssetMiniappStyle) ?? "plain_white",
  );
```

**UI 控件**

使用 ShadcnUI `<Select>`，i18n key 位于 `superAdmin.orgs.textAsset.*`：

```tsx
<Select
  value={textAssetMiniappStyle}
  onValueChange={(v) => setTextAssetMiniappStyle(v as TextAssetMiniappStyle)}
>
  <SelectTrigger className="h-8 text-sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="plain_white">
      {t("superAdmin.orgs.textAsset.plain_white")}
    </SelectItem>
    <SelectItem value="dialog_decorated">
      {t("superAdmin.orgs.textAsset.dialog_decorated")}
    </SelectItem>
  </SelectContent>
</Select>
```

**保存**

通过 Server Action `updateOrganization`（`app/super-admin/organizations/actions.ts`）提交，随其他字段一并保存。`hasChanged` 检查中包含此字段。

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

## 小程序端消费方式（待实现）

小程序端在渲染 `text` 类型资源时，通过接口获取所属组织的 `text_asset_miniapp_style`，据此切换组件或样式类：

```
text_asset_miniapp_style
  ├── "plain_white"       → <PlainTextCard />
  └── "dialog_decorated"  → <DialogCard />
```

推荐在小程序侧的组织信息缓存中一并存储该字段，避免每次渲染资源时额外请求。

---

## 扩展新样式

1. **数据库**：更新 CHECK 约束，新增枚举值。
2. **类型**：在 `TextAssetMiniappStyle`（`app/manage/types.ts`）中追加新值。
3. **Server Action**：在 `VALID_MINIAPP_STYLES`（`actions.ts`）数组中追加新值。
4. **前端**：在 `OrgDetailPanel` 的 `<SelectContent>` 中新增 `<SelectItem>`。
5. **i18n**：在 `superAdmin.orgs.textAsset` 下新增对应 key。
6. **小程序**：实现对应渲染组件。
