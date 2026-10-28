# 团队工作台与地图合集

本文说明前端信息架构和数据流。团队权限见 [权限体系](permissions.md)，服务端请求与一致性规则见 [后端契约](team-workbench-backend-contract.md)。

## 内容组织

Organization 在界面上称为团队。团队拥有素材和 Scene，成员共享全部内容；地图合集对应 workspace 行，只组织投放和标签。同一素材或场景可在多个合集投放。

新团队没有默认合集。上传素材、创建/导入/复制场景不需要选择合集；地图投放时才指定位置和合集。素材、场景直接保存当前内容。

## 页面入口

| 路由 | 内容 |
| --- | --- |
| `/manage` | 默认进入基础素材，保留团队上下文 |
| `/manage/assets` | 素材网格/列表、搜索、类型和归档筛选、上传 |
| `/manage/assets/[id]` | 预览、编辑当前内容、使用记录、重命名、副本、归档/恢复 |
| `/manage/scenes` | 场景库、搜索、归档筛选、新建与 JSON 导入 |
| `/manage/scenes/[id]` | 场景编辑器、团队模型选择、保存与二维码预览；返回场景列表 |
| `/manage/collections` | 合集列表、新建与归档/恢复；团队级小程序二维码 |
| `/manage/collections/[id]` | 全窗口地图编辑器；合集名称、归档状态与合集二维码 |
| `/upload-onsite` | 页面内选择团队/合集，确认位置后上传并投放 |
| `/admin/settings`、`/admin/members` | 按权限提供团队设置和成员管理 |

侧边栏区分地图合集、场景和基础素材，桌面常驻，窄屏通过抽屉展开。合集卡片在新标签页打开地图编辑器；该页面不显示主页 navbar，选择状态只在当前地图上下文使用。Scene 编辑与地图编辑保留各自完整工作空间。

## 数据与权限

路由容器通过 `app/manage/lib/content-api.ts` 调用内容接口，上传预处理通过 `content-upload.ts`。基础素材分页加载并由服务端筛选；场景独立加载，在客户端按名称筛选。

展示组件位于 `app/manage/content/`，接收数据与操作回调；数据请求、导航和操作编排由 `app/manage/workbench/`、合集和素材详情路由组件负责。

团队级入口使用 `teamCanWrite()`；具体资源操作读取服务端 DTO 的 capabilities，例如 `can_maintain`、`can_edit`、`can_archive`。只读原因应明确展示。服务端仍重新验证每次请求，隐藏按钮不构成授权。

## 团队与资源上下文

- 基础素材类型以 URL 的 `type` 为准；场景通过独立路由区分。
- 页头切换团队时改写 `organizationId` 并移除 `workspaceId`，不自动进入第一个合集。
- 详情页通过 `useResourceTeam()` 对齐资源所属团队和 URL；对齐前显示加载状态。用户主动切换团队时返回新团队对应列表。
- 合集由 URL 指定；现场上传在页面内选择。链接已指定但失效的合集不会被静默替换，用户需重新选择；未指定且团队只有一个合集时可自动选中。
- 合集归档/恢复后重新加载地图与投放能力。
- 网格/列表偏好存于 localStorage 的 `sanlin.workbench.view`；搜索和归档筛选保留在页面状态。

原 workspace UUID 继续作为合集和二维码标识。地图读写的是 Placement，细节见 [地图交互](map-asset-interaction.md)；场景保存与播放见 [Scene](scene-asset.md)。
