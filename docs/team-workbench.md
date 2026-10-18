# 团队工作台与地图合集（前端）

日期：2026-10-17。状态：本分支采用单一内容模型，生产部署状态需另行确认。后端规则、DTO 变更与路由以 [团队工作台后端契约](team-workbench-backend-contract.md) 为准；本文记录前端信息架构、数据流和数据迁移。旧方案 [团队素材复用与场景管理改造方案](team-assets-scenes-refactor-plan.md) 的项目授权与项目角色部分由本文和后端契约取代。

## 1 已确认的产品决策

用户对照登录后的 Kivicube 后确认：

1. 侧边栏分为地图合集、场景、基础素材三个入口；场景与素材独立浏览。
2. 团队成员共享全部内容和合集，不再细分项目权限。

由此得到的界面规则：

- Organization 在界面上统一称为**团队**。团队是唯一的所有权与权限边界。
- 没有全局项目（Workspace）选择器，没有项目授权、项目成员矩阵或维护者门禁。`maintained_by` 只作为“维护人”信息显示。
- 上传素材、新建/导入/复制场景、编辑与发布都不需要选择合集。
- **合集**是放置内容的地方。首期只有一种合集：地图合集，对应原 Workspace 行（UUID 不变）。同一个场景或素材可以放进多个合集。
- 团队角色 owner/admin/member/viewer 保留：viewer 只读，其余角色可写。
- 新账号的个人团队、管理接口新建的团队直接进入工作台，初始没有合集；创建内容无需激活步骤。已有团队由数据库迁移统一转换。

## 2 信息架构

侧边栏导航（`app/manage/components/ContentNav.tsx`）：**地图合集 / 场景 / 基础素材**，团队设置作为辅助入口。团队切换只在页头面包屑；只有一个团队时也只显示团队名称。

| 路由 | 内容 |
| --- | --- |
| `/manage` | 默认进入基础素材，保留 URL 中的团队。 |
| `/manage/assets` | 基础素材：缩略图网格（可切换列表）、搜索、素材类型下拉筛选、未归档/已归档、上传素材。 |
| `/manage/scenes` | 场景：独立网格或列表、搜索、未归档/已归档、新建场景、导入场景 JSON。 |
| `/manage/assets/[id]` | 素材详情：预览、直接编辑内容、使用记录（场景与各合集中的投放）、重命名、另存副本、归档/恢复。 |
| `/manage/scenes/[id]` | 场景编辑器：团队模型选择器（本场景 / 团队模型）、保存、发布（可同时更新任意合集中的投放）。返回场景列表。 |
| `/manage/collections` | 合集列表：新建、编辑、归档/恢复地图合集；页头提供团队级小程序二维码（原“全部项目”二维码）。 |
| `/manage/collections/[id]` | 合集卡片在新标签页打开全窗口地图编辑器，不显示主页 navbar。保留 PlacementMapView/Cesium 布局，顶部细栏显示返回、合集名、归档状态和该合集的小程序二维码；合集主页不显示二维码。选择与多选只在本页有效。 |
| `/upload-onsite` | 现场上传：在页面内选择团队和一个地图合集（本页局部状态），确认位置后一步上传并投放。链接指定的合集（`collectionId`/`workspaceId`）不会被替换：已归档或不存在时提示原因并要求重新选择；只有未指定目标时才自动选中团队唯一的合集。 |
| `/admin/*` | 团队设置：设置、成员。`/admin` 落到当前角色可见的第一页。 |

落地页 `/` 仍公开；已登录的主按钮进入 `/manage`。

## 3 数据流

页面只通过 `app/manage/lib/content-api.ts` 访问接口，请求不需要内容模型版本头。

| 场景 | 接口 |
| --- | --- |
| 工作台素材 | `GET /api/organizations/[id]/assets?view=all`（分页，服务端按名称/类型/状态筛选） |
| 工作台场景 | `GET /api/organizations/[id]/scenes?state=`（不分页，客户端按名称筛选） |
| 上传素材 | `POST /api/upload`（`organization_id`，不传 `workspace_id`）→ `POST /api/organizations/[id]/assets` |
| 新建/导入场景 | `POST /api/organizations/[id]/scenes` |
| 复制场景 / 另存素材副本 | `POST /api/scenes/[id]/copy`、`POST /api/assets/[id]/duplicate`，均不传 `targetWorkspaceId` |
| 编辑素材 | 上传回执只绑定团队，再 `PATCH /api/assets/[id]`；地图和场景引用读取更新后的内容 |
| 合集 | `GET/POST /api/organizations/[id]/collections`，`GET/PATCH /api/collections/[id]`，`POST/DELETE /api/collections/[id]/archive` |
| 合集地图 | `/api/collections/[collectionId]/placements` 与 `/api/placements/**`；来源选择器读取团队全部素材和已发布场景 |
| 现场上传 | 回执带 `organization_id` + 合集 `workspace_id`，再 `POST /api/collections/[collectionId]/placements` |

基础素材页只加载分页素材，场景页只加载场景；两者均按最近更新排序。桌面侧边栏常驻，窄屏通过“浏览内容”展开抽屉；详情返回各自列表，地图与场景编辑器保留完整编辑空间。

## 4 权限在前端的表达

- 界面开关不是安全边界；服务端逐条重新校验。
- 团队级写权限 `teamCanWrite()`：团队未归档，且团队角色可写（owner/admin/member）或全局 super_admin。后端仍会逐请求校验。
- 素材、场景、合集、投放的具体操作只看 DTO 的 `capabilities`（`can_maintain`、`can_edit`、`can_publish`、`can_archive`）。
- 只读原因明确告诉用户：查看者、团队归档、或非本团队成员。

## 5 团队上下文与资源归属

- 基础素材类型筛选以 URL `?type=` 为准；场景通过独立路由区分，不属于素材类型筛选。
- 切换团队时，页头同步只改写 `organizationId`，并删除 `workspaceId`，绝不把新团队默认的第一个合集写进 URL。工作台、合集列表因此留在原页面。
- 合集详情、素材详情、场景编辑器由资源自身的团队决定上下文（`useResourceTeam()`）：首次加载时若 URL 缺少或指向别的团队，先把 URL 改为资源所属团队，由页头同步切换团队；两者一致前只显示加载状态，不渲染可操作内容。之后用户在页头切换团队，视为离开该资源：合集详情回到新团队的合集列表，素材与场景分别回到新团队的基础素材和场景列表。super_admin 查看不在自己团队列表中的资源时，页头无法显示该团队，团队列表加载完成后直接显示内容。
- 合集恢复或归档后，地图会重新挂载并重新读取投放能力，无需手动刷新。

## 6 单一模型

原 workspace 的 UUID 保留为地图合集 ID，二维码继续定位该合集。运行时不再读取旧 Asset 内容字段、项目授权或共享 scope。旧页面和 API 别名已删除，存量数据由事务迁移转换到新结构。页面只保存团队选择，合集由 URL 或现场上传中的显式选择决定。

网格/列表偏好按设备保存在 `localStorage` 的 `sanlin.workbench.view`；类型筛选由 URL 决定，搜索和归档状态保留在当前页面状态中。

## 7 组件与 Storybook

展示层位于 `app/manage/content/`，只接收 props 与 `ContentAction` 回调：`ContentWorkbench`、`WorkbenchToolbar`、`WorkbenchItems`、`WorkbenchCard`、`WorkbenchRow`、`WorkbenchEmpty`、`CollectionList`、`CollectionCard`、`LibraryCard`、`CollectionFormDialog`、`CollectionArchiveDialog`、`CollectionHeaderBar`。数据、权限与跳转在 `app/manage/workbench/`、`app/manage/collections/components/` 等路由组件中。

Storybook：`stories/content/content-workbench.stories.tsx`（网格、列表、类型筛选、归档、查看者只读、团队归档、加载、错误、空团队、无匹配、手机）、`workbench-card`、`workbench-row`、`workbench-toolbar`、`collection-list`、`collection-form-dialog`、`collection-archive-dialog`、`collection-header-bar`，以及 `stories/manage/content-integration/content-nav.stories.tsx` 和 `team-frame.stories.tsx`（三类页面、空态、只读、英文、窄屏）。

已删除的展示组件：素材库行与工具栏、场景列表、项目上下文行、素材共享/授权面板、维护者转交对话框、项目角色选择器，以及管理后台的项目成员对话框。

## 8 实现与验证

API 和可空字段以 [后端契约](team-workbench-backend-contract.md) 为准。迁移步骤见 [单一模型迁移说明](content-model-migration-runbook.md)。后端能力控制合集与投放操作；前端角色提示不能代替服务端授权。

变更后运行类型检查、lint、生产构建、Storybook，以及迁移、服务和路由集成测试。历史双模型验收结果不作为当前分支的通过证据。
