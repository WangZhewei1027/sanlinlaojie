## 组织配置扩展流程（Web 管理端 → 小程序消费）

当需要为组织添加新的可配置项时，遵循以下步骤。

---

### 第一步：数据库

`organization` 表有一个 `config jsonb NOT NULL DEFAULT '{}'` 字段，直接在其中新增 key，无需加列。

---

### 第二步：Web 管理端

#### 1. 类型（`app/super-admin/organizations/types.ts`）

在 `OrgConfig` 接口中加字段：

```ts
export interface OrgConfig {
  confetti_enabled?: boolean;
  your_new_field?: YourType;
}
```

#### 2. API 路由（`app/api/admin/organizations/route.ts`）

确保 select 列表包含 `config`：

```ts
.select(`id, name, ..., config, organization_member (...)`)
```

#### 3. Hook（`app/super-admin/organizations/hooks/useOrgDetailForm.ts`）

- 初始化 state：`useState(org.config?.your_new_field ?? defaultValue)`
- 加入 `hasChanged` 比较
- `handleSave` 时写入 `config: { ...existingFields, your_new_field: value }`

#### 4. UI 组件（`app/super-admin/organizations/components/sections/`）

新建 section 组件，参考 `MiniappConfigSection.tsx`：

- 使用已有 UI 组件（`Checkbox`、`Select` 等，注意 `Switch` 未安装）
- 引入 `SectionHeader` + i18n

#### 5. 串联（`OrgFormSections.tsx` → `OrgDetailPanel.tsx`）

- `OrgFormSections` 加 props、渲染新 section
- `OrgDetailPanel` 从 hook 取新值并透传

#### 6. i18n（用 Python 更新，避免加载大 JSON 到上下文）

```python
python3 - <<'EOF'
import json
for lang, zh, en in [
    ('zh', '中文标签', '...'),
    ('en', '...', 'English Label'),
]:
    path = f'locales/{lang}.json'
    with open(path) as f: d = json.load(f)
    d['superAdmin']['orgs']['section']['yourSection'] = zh if lang == 'zh' else en
    d['superAdmin']['orgs']['yourSection'] = {'yourKey': zh if lang == 'zh' else en}
    with open(path, 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
EOF
```

---

### 第三步：小程序消费

小程序通过 `fetchOrgStyle`（`miniprogram/components/xr-start/index.js`）拉取组织配置：

```js
// select 中加上 config 字段（已包含）
`id=eq.${orgId}&select=text_asset_miniapp_style,config`;

// 结果存入 this._orgConfig
this._orgConfig = cfg && typeof cfg === "object" ? cfg : {};
```

在需要读取配置的地方直接使用：

```js
if (this._orgConfig && this._orgConfig.your_new_field) {
  // 执行对应逻辑
}
```

> `fetchOrgStyle` 在组件 `attached()` 时调用，早于资源加载完成，读取时序安全。

---

### 注意事项

- `config` 字段更新时应合并写入，不要覆盖整个对象：`config: { ...existingConfig, new_key: value }`
- 小程序使用 anon key 直连 Supabase REST，`organization` 表无 RLS，字段直接可读
- 新配置项默认值应为"关闭/保守"状态（如 `false`、`null`），避免意外开启功能
