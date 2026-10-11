# i18n 国际化使用指南

## 配置文件

- **配置文件**: `lib/i18n/config.ts`（初始化 i18next，加载下面的 JSON）
- **语言设置**: `lib/i18n/settings.ts`（支持语言 `zh | en`、默认 `zh`、cookie 名 `language`）
- **翻译文件**: `locales/zh.json` / `locales/en.json`
- **语言切换组件**: `components/language-switcher.tsx`
- **Provider**: `components/i18n-provider.tsx`

## 在组件中使用翻译

### 1. 客户端组件 (Client Component)

```tsx
'use client';

import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

### 2. 添加新的翻译

在 `locales/zh.json` 和 `locales/en.json` 中添加新的翻译键值对（`lib/i18n/config.ts` 只负责加载这两个文件，不包含文案）：

```json
// locales/zh.json
{
  "mySection": {
    "title": "我的标题",
    "description": "我的描述"
  }
}

// locales/en.json
{
  "mySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

两个文件的键必须成对出现；`scripts/clean-i18n.py` 可清理代码中已不再引用的键。

### 3. 使用翻译

```tsx
const { t } = useTranslation();

// 使用方式
<h1>{t('mySection.title')}</h1>
<p>{t('mySection.description')}</p>
```

## 现有翻译键

键按功能划分为顶层命名空间，当前 `locales/zh.json` 包含：
`account`、`admin`、`assetEditor`、`assetFields`、`assetManager`、`auth`、`common`、`errors`、`fileTypes`、`home`、`invite`、`linkAsset`、`manage`、`matching`、`nav`、`onsite`、`organization`、`settings`、`superAdmin`、`upload`、`workspace`。

具体键名以 JSON 文件为准（例如 `common.save`、`upload.title`、`nav.admin`），新增前先在文件中搜索是否已有可复用的键。

## 语言切换

语言切换按钮位于全局导航栏 `components/navbar.tsx`（由 `app/layout.tsx` 渲染，所有页面共用）。

用户选择的语言通过 `applyLanguage()`（`components/i18n-provider.tsx`）写入 cookie `language`，`app/layout.tsx` 在服务端渲染首帧时读取该 cookie，保证两端首帧语言一致；同时写入 localStorage 以兼容旧版本。刷新页面后会自动恢复。

## 示例：更新现有组件

```tsx
'use client';

import { useTranslation } from 'react-i18next';

export function WorkspaceSelect() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h2>{t('workspace.select')}</h2>
      <button>{t('workspace.create')}</button>
    </div>
  );
}
```
