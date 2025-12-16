# i18n 国际化使用指南

## 配置文件

- **配置文件**: `lib/i18n/config.ts`
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

在 `lib/i18n/config.ts` 中添加新的翻译键值对：

```typescript
const zhTranslations = {
  translation: {
    // 添加你的翻译
    mySection: {
      title: '我的标题',
      description: '我的描述',
    },
  },
};

const enTranslations = {
  translation: {
    // 添加对应的英文翻译
    mySection: {
      title: 'My Title',
      description: 'My Description',
    },
  },
};
```

### 3. 使用翻译

```tsx
const { t } = useTranslation();

// 使用方式
<h1>{t('mySection.title')}</h1>
<p>{t('mySection.description')}</p>
```

## 现有翻译键

### 导航栏 (nav)
- `nav.home` - 首页
- `nav.admin` - 管理后台
- `nav.workspace` - 工作空间
- `nav.upload` - 上传
- `nav.manage` - 管理
- `nav.display` - 展示

### 通用 (common)
- `common.welcome` - 欢迎
- `common.loading` - 加载中...
- `common.save` - 保存
- `common.cancel` - 取消
- `common.delete` - 删除
- `common.edit` - 编辑
- `common.create` - 创建
- `common.search` - 搜索
- `common.filter` - 筛选
- `common.logout` - 退出登录
- `common.login` - 登录
- `common.signup` - 注册

### 工作空间 (workspace)
- `workspace.title` - 工作空间管理
- `workspace.create` - 创建工作空间
- `workspace.select` - 选择工作空间
- `workspace.manage` - 管理工作空间

### 上传 (upload)
- `upload.title` - 上传资源
- `upload.selectFile` - 选择文件
- `upload.uploading` - 上传中...
- `upload.success` - 上传成功
- `upload.failed` - 上传失败

### 资源管理 (assets)
- `assets.title` - 资源管理
- `assets.list` - 资源列表
- `assets.edit` - 编辑资源
- `assets.delete` - 删除资源

## 语言切换

语言切换按钮已添加到：
1. 主页导航栏
2. 主页页脚
3. Protected 布局的导航栏
4. Protected 布局的页脚

用户选择的语言会保存在 localStorage 中，刷新页面后会自动恢复。

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
