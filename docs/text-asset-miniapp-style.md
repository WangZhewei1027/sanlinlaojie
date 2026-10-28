# 小程序文字素材样式

`organization.config.text_asset_miniapp_style` 控制团队文字素材在小程序中的展示。它是 jsonb 配置键，不是独立数据库列；新增样式无需修改数据库 CHECK 约束。

| 值 | 展示 |
| --- | --- |
| plain_white | 纯白文字 |
| dialog_decorated | 对话框气泡，键缺失时的默认值 |

Web 默认值定义在 [components/org-settings/types.ts](../components/org-settings/types.ts)，类型 `TextAssetMiniappStyle` 定义在 `app/manage/types.ts`。

## 配置与读取

- 团队 owner / super_admin 在 `/admin/settings` 配置；super_admin 也可通过 `/super-admin/organizations` 的团队详情配置。
- 两处共用 `components/org-settings/OrgSettingsForm.tsx` 和 `TextAssetStyleSection.tsx`，状态与保存由 `useOrgSettingsForm.ts` 管理。
- 团队设置通过 `PUT /api/organizations/[id]` 保存，超级管理员通过 `app/super-admin/organizations/actions.ts` 的 `updateOrganization` 保存。
- 两条写路径都过滤非法样式值；有效值随 config 写入，不改动独立列。
- 小程序通过 `GET /api/miniapp/organizations?ids=…` 获取公开 config 子集。字段必须在路由的 `PUBLIC_CONFIG_KEYS` 白名单中，见 [小程序接口](miniapp-api.md)。

## 扩展样式

同步修改 TypeScript 类型、两个写入口的白名单、共享表单选项和 `superAdmin.orgs.textAsset` 下的中英文文案。小程序独立仓库还需实现对应渲染分支，并验证缺省样式与 Web 一致。组织配置的通用扩展流程见 [开发指引](../.github/instructions/org-config.instructions.md)。
