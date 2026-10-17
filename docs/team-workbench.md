# 团队工作台与地图合集（前端）

日期：2026-10-17。状态：前后端已完成集成和 Codex 独立验收，本地数据库迁移已应用，未部署生产环境。后端规则、DTO 变更与路由以 [团队工作台后端契约](team-workbench-backend-contract.md) 为准；本文记录前端信息架构、数据流和兼容边界。旧方案 [团队素材复用与场景管理改造方案](team-assets-scenes-refactor-plan.md) 的项目授权与项目角色部分由本文和后端契约取代。

## 1 已确认的产品决策

用户对照登录后的 Kivicube 后确认：

1. 素材与场景共用一个工作台，按类型筛选。
2. 团队成员共享全部内容和合集，不再细分项目权限。

由此得到的界面规则：

- Organization 在界面上统一称为**团队**。团队是唯一的所有权与权限边界。
- 没有全局项目（Workspace）选择器，没有项目授权、项目成员矩阵或维护者门禁。`maintained_by` 只作为“维护人”信息显示。
- 上传素材、新建/导入/复制场景、编辑与发布都不需要选择合集。
- **合集**是放置内容的地方。首期只有一种合集：地图合集，对应原 Workspace 行（UUID 不变）。同一个场景或素材版本可以放进多个合集。
- 团队角色 owner/admin/member/viewer 保留：viewer 只读，其余角色可写。
- 新账号的个人团队、管理接口新建的团队直接进入 v2 工作台，初始没有合集；创建内容无需激活步骤。已有团队保持原迁移状态。

## 2 信息架构

主导航（`app/manage/components/ContentNav.tsx`）：**工作台 / 合集 / 团队设置**。团队切换只在页头面包屑；只有一个团队时也只显示团队名称。

| 路由 | 内容 |
| --- | --- |
| `/manage` | 工作台：团队全部素材与场景。缩略图网格（可切换列表），搜索、全部/场景/模型/图片/视频/音频/文字/链接/文档筛选、未归档/已归档、上传素材、新建场景、导入场景 JSON。`?type=scene` 保留筛选。 |
| `/manage/assets/[id]` | 素材详情：预览、版本、使用记录（场景与各合集中的投放）、重命名、另存副本、归档/恢复。 |
| `/manage/scenes/[id]` | 场景编辑器：团队模型选择器（本场景 / 团队模型）、保存、发布（可同时更新任意合集中的投放）。返回工作台的场景筛选。 |
| `/manage/collections` | 合集列表：新建、编辑、归档/恢复地图合集；页头提供团队级小程序二维码（原“全部项目”二维码）。 |
| `/manage/collections/[id]` | 合集地图：原 PlacementMapView/Cesium 布局，顶部细栏显示返回、合集名、归档状态和该合集的小程序二维码。选择与多选只在本页有效。 |
| `/upload-onsite` | 现场上传：在页面内选择团队和一个地图合集（本页局部状态），确认位置后一步上传并投放。链接指定的合集（`collectionId`/`workspaceId`）不会被替换：已归档或不存在时提示原因并要求重新选择；只有未指定目标时才自动选中团队唯一的合集。 |
| `/admin/*` | 团队设置：设置、成员。`/admin` 落到当前角色可见的第一页。 |

落地页 `/` 仍公开；已登录的主按钮进入 `/manage`。

## 3 数据流

页面只通过 `app/manage/lib/content-api.ts` 访问接口，全部请求带 `X-Content-Model: 2`。

| 场景 | 接口 |
| --- | --- |
| 工作台素材 | `GET /api/organizations/[id]/assets?view=all`（分页，服务端按名称/类型/状态筛选） |
| 工作台场景 | `GET /api/organizations/[id]/scenes?state=`（不分页，客户端按名称筛选） |
| 上传素材 | `POST /api/upload`（`organization_id`，不传 `workspace_id`）→ `POST /api/organizations/[id]/assets` |
| 新建/导入场景 | `POST /api/organizations/[id]/scenes` |
| 复制场景 / 另存素材副本 | `POST /api/scenes/[id]/copy`、`POST /api/assets/[id]/duplicate`，均不传 `targetWorkspaceId` |
| 新版本 | 上传回执只绑定团队，再 `POST /api/assets/[id]/versions` |
| 合集 | `GET/POST /api/organizations/[id]/collections`，`GET/PATCH /api/collections/[id]`，`POST/DELETE /api/collections/[id]/archive` |
| 合集地图 | 原 `/api/workspaces/[collectionId]/placements` 与 `/api/placements/**`（仅地图适配器使用 workspace 路径）；来源选择器读取团队全部素材和已发布场景 |
| 现场上传 | 回执带 `organization_id` + 合集 `workspace_id`，再 `POST /api/workspaces/[collectionId]/placements` |

工作台把分页素材与场景合并为“最近更新在前”的一个列表：素材尚未加载完时，比已加载最后一个素材更旧的场景先不显示，保证“加载更多”不会打乱已显示的顺序。

## 4 权限在前端的表达

- 界面开关不是安全边界；服务端逐条重新校验。
- 团队级写权限 `teamCanWrite()`（`app/manage/lib/content-context.ts`）：组织状态为 `v2`、团队未归档（`archived_at` 为空，super_admin 也不例外），且后端声明的团队能力（若提供 `capabilities.can_edit`）允许，否则按当前团队角色（`org.assets.write`，member 及以上）或 super_admin 判断。**不读取任何项目 assignment。**
- 素材、场景、合集、投放的具体操作只看 DTO 的 `capabilities`（`can_maintain`、`can_edit`、`can_publish`、`can_archive`）。
- 只读原因明确告诉用户：查看者、迁移冻结、或非本团队成员。

## 5 团队上下文与资源归属

- 工作台的类型筛选以 URL `?type=` 为准；导航“工作台”链接、编辑器返回链接和浏览器前进/后退都会同步筛选。
- 切换团队时，页头同步只改写 `organizationId`，并删除 `workspaceId`，绝不把新团队默认的第一个合集写进 URL（否则会被当作旧链接跳进地图）。工作台、合集列表因此留在原页面。
- 合集详情、素材详情、场景编辑器由资源自身的团队决定上下文（`useResourceTeam()`）：首次加载时若 URL 缺少或指向别的团队，先把 URL 改为资源所属团队，由页头同步切换团队；两者一致前只显示加载状态，不渲染可操作内容。之后用户在页头切换团队，视为离开该资源：合集详情回到新团队的合集列表，素材与场景回到新团队的工作台。super_admin 查看不在自己团队列表中的资源时，页头无法显示该团队，团队列表加载完成后直接显示内容。
- 合集恢复或归档后，地图会重新挂载并重新读取投放能力，无需手动刷新。

## 6 兼容边界

| 输入 | 处理 |
| --- | --- |
| `/manage?organizationId=&workspaceId=`（旧链接、旧使用记录、旧收据） | v2/readonly 团队重定向到 `/manage/collections/[workspaceId]`，保留 `placementId` 等其他参数 |
| `/manage/assets`、`/manage/scenes` | 重定向到工作台；后者带 `?type=scene`。原 `workspaceId` 参数丢弃 |
| `/admin/workspaces` | v2/readonly 团队重定向到 `/manage/collections`；legacy 团队保留原页面（不再提供项目成员对话框） |
| 持久化的 `selectedWorkspaceId` | 仅 legacy 素材地图、legacy 场景编辑器和 legacy 现场上传读取；v2 页面使用 `useTeamContext()`，不暴露工作区选择，避免隐藏默认合集 |
| 小程序二维码 | 参数仍为 `organizationId` / `workspaceId`，对象键不变，旧二维码继续有效；合集页生成的就是原工作区二维码 |
| legacy / preparing 团队 | `/manage` 仍是旧素材地图，页头保留工作区切换器与二维码；工作台与合集页显示迁移状态说明 |
| readonly 团队 | 工作台和合集列表只读浏览；合集详情使用旧素材地图只读显示 |
| 成员页“分配合集” | 所有团队均已移除此入口；历史 assignment 保留为数据，不再决定权限 |

网格/列表偏好按设备保存在 `localStorage` 的 `sanlin.workbench.view`；类型筛选由 URL 决定，搜索和归档状态保留在当前页面状态中。

## 7 组件与 Storybook

展示层位于 `app/manage/content/`，只接收 props 与 `ContentAction` 回调：`ContentWorkbench`、`WorkbenchToolbar`、`WorkbenchItems`、`WorkbenchCard`、`WorkbenchRow`、`WorkbenchEmpty`、`CollectionList`、`CollectionRow`、`CollectionFormDialog`、`CollectionArchiveDialog`、`CollectionHeaderBar`。数据、权限与跳转在 `app/manage/workbench/`、`app/manage/collections/components/` 等路由组件中。

Storybook：`stories/content/content-workbench.stories.tsx`（网格、列表、类型筛选、归档、查看者只读、迁移冻结、加载、错误、空团队、无匹配、手机）、`workbench-card`、`workbench-row`、`workbench-toolbar`、`collection-list`、`collection-form-dialog`、`collection-archive-dialog`、`collection-header-bar`，以及 `stories/manage/content-integration/content-nav.stories.tsx`。

已删除的展示组件：素材库行与工具栏、场景列表、项目上下文行、素材共享/授权面板、维护者转交对话框、项目角色选择器，以及管理后台的项目成员对话框。

## 8 实现约定

- 依赖后端契约第 2–4 节的路由与可空字段（`SceneSummaryDto.workspace_id`、`UploadReceiptDto.workspace_id`、依赖项中的 `workspace_name` 等）。
- 团队级“可写”目前由前端按角色推断；若后端在 `OrganizationContentModelDto.capabilities` 中加入 `can_edit`，前端会自动以它为准。
- `/api/workspaces` 由后端改为返回团队全部合集，legacy 页面的工作区列表随之扩大，这是预期行为。

## 9 验收记录（2026-10-17）

- Claude 完成实现及一次集中修正；Codex 独立检查实际 diff，并复跑 43 组服务测试、11 组真实路由处理器测试、隔离上传去重测试和生产构建启动的本地服务上的 HTTP 测试，全部通过。
- `npm run typecheck`、`npm run lint`、`npm run build`、`npm run build-storybook` 通过。Lint 为 0 errors / 21 warnings；生产构建包含 212 个客户端 bundle 的语法检查，Storybook 包含 298 个故事。
- 浏览器实测：新账号的零合集团队直接创建文字素材和场景，添加本地测试模型、修改位置、保存、发布 v1；全过程没有创建隐含合集。另一个团队中创建合集和投放，归档后只读，恢复后无需刷新即可继续编辑。
- 多团队切换留在工作台；详情页切换团队返回新团队工作台；错误团队参数的素材链接按资源真实归属修正。类型筛选与 URL 同步，桌面及 390px 中英文界面完成检查。
- Impeccable 完成一轮修正与确认，最终结论为 ship。Cesium 地图另在普通 Chrome 窗口中确认可正常渲染。
- 本地迁移前后原有 2,038 个素材 ID、2,033 个素材版本、5 个场景及其 5 个发布版本、1,952 个投放和 81 个合集保留；不可变版本内容及投放的来源、位置、锚点和渲染配置快照一致。
- 浏览器写操作使用专用 `team_wb_http` 数据库和一次性账号；真实 OSS 完整上传链路、现场定位和小程序 AR 真机未作为本次最终验收项。
