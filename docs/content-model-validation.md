# 团队内容模型实施与验证记录（历史）

> 本文记录 2026-10-15 至 17 日的历史实现，不代表当前架构。版本固定、发布、模型状态和分阶段切换均已删除。当前模型见 [数据层](data-layer.md)，上线依据 [迁移手册](content-model-migration-runbook.md) 和 [2026-10-19 上线检查](release-readiness-20261019.md)。

首轮实施日期：2026-10-15；本地内容切换跟进：2026-10-17。对应 [改造方案](team-assets-scenes-refactor-plan.md) 的首期静态内容能力。前文记录首轮隔离验证，当前原开发库状态以下方 2026-10-17 跟进为准。

## 已实现

- Organization 保持租户边界；Workspace 在产品中统一称为项目。项目 manager/editor/viewer 与组织角色共同控制权限，组织 viewer 不会因项目角色而升权。
- Asset 是素材身份；AssetVersion 与资源清单不可变。项目授权、维护者、组织共享、使用记录和归档分别管理，上传新版不会替换旧引用。
- Scene 是独立作品，schema 3 草稿固定 `{assetId, assetVersionId}`，保存使用乐观锁，发布生成不可变 SceneRevision。发布时逐项校验要更新的投放锁。
- Placement 独立保存位置、状态和显示配置，只引用一个 AssetVersion 或 SceneRevision。共享旧 scope 通过固定内容接口预览，不获得源目录和历史版本权限。
- 新素材库、素材详情、场景列表、场景编辑器、投放地图、现场上传和项目成员管理已接入新模型。旧组织按状态保留旧写源；执行 DDL 不会自动切换现有组织。
- 文件保留覆盖全部历史版本、旧引用和在途回执；实际物理删除默认关闭。按哈希查询校验来源权限，实际上传后的文件去重按组织处理。
- 迁移包含 audit、审核输入、inventory、dry-run、幂等 backfill、verify、冻结 cutover 和受限 rollback。未知旧角色降为 viewer 并写隔离账本。
- 种树活动只保留内容解析、业务服务和展示适配边界，没有新增 Activity/Topic/Reply 空表、活动菜单或通用规则引擎。

Claude 分别承担后端、展示组件和页面接线；Codex 负责实际差异检查、迁移工具与回归、跨模块接线修复、独立数据库及浏览器验收。使用的设计流程是 Impeccable 的既有 Operate 界面扩展。

## 验证环境与结果

本节记录 2026-10-15 首轮验证：数据库验证使用一次性容器 `sanlin-content-model-verify-1015` 的回环端口 `55439`，当时未迁移原开发库 `55432`，未部署或操作生产数据。Web 验证运行在隔离源码副本和 `13000` 端口，原开发服务 `3000` 未停止；依赖和静态文件只读复用。

| 验证 | 结果与范围 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 通过，206 个客户端 bundle 语法检查通过 |
| `npm run build-storybook` | 通过 |
| `npm run db:codegen` | 从最新一次性 fresh 库生成 34 张表的类型 |
| `test-content-model-services.ts` | 40/40 集成组通过：使用/维护权限、版本固定、冲突、发布重试、投放独立性、文件保护、冻结竞态、匿名文字、共享固定内容、hash 权限、旧暂存数据退役 |
| `test-content-model-http.ts` | 真实登录和 HTTP 闭环通过：跨项目复用、403/404/409/428、依赖名称隔离、固定内容接口、发布、复制、暂停、公开发现和归档保留 |
| `test-content-model-contracts.ts` / `test-content-model-url-resources.ts` | 通过：schema 3 引用/别名、旧协议编译、权限及资源 URL 规范化 |
| `test-content-model-audit.ts` | 旧基线审计通过，包含跨组织、异常角色、坏场景及孤立记录 |
| `test-content-model-migration.ts` | 完整迁移与 snapshot-guard-only 均通过；旧 REPEATABLE READ 事务不能越过切换点回写 |
| fresh 与历史 upgrade | 应用结构完全一致：278 列、146 约束、25 函数、90 索引、12 触发器；重复运行均 up to date |
| 历史数据保留 | 升级保留 11 条旧 fixture 素材；未创建 AssetVersion、未自动启用 v2；未知角色和无组织成员分配降为 viewer 并隔离 |
| Web 既有纯逻辑测试 | scene authoring / timeline / interactions 通过；固定投放客户端缓存另有 14 项纯内存断言通过 |
| 小程序播放回归 | sibling `xr-frame-plant-trees` 的 `npm --ignore-scripts test` 九组通过；跳过会改写本地地址配置的 pretest，播放源码未修改 |
| 浏览器操作 | 素材列表/详情、版本和使用记录、项目切换、场景修改保存发布及选定投放更新、素材直接投放、独立暂停、成员表单与无 GPS 时禁止上传已验证 |
| 独立 UI 审查 | 15 张桌面/移动端/695px 截图有效；修正生命周期筛选“使用中”为“未归档”，三种宽度复审通过，无剩余必修项 |

新增 HTTP 断言另行通过其 ESLint 和全仓 TypeScript 检查；UI 复审的单项文案修正后，生产构建再次通过。产品源码与最后一次成功构建的副本逐文件 hash 一致。

桌面、390px 移动端与实际 695px 窗口的截图已从仓库移出，保留在工作区父目录 `.local-db-backups/ui-review-20261019/` 和 Git 历史中。浏览器使用本地 fixture 模型；Cesium 库读取已配置的公开静态地址，没有上传、删除 OSS 对象，也没有调用付费识别模型。

构建日志中有既有 Browserslist/baseline 数据过期及 bundle 体积提示，未因此升级依赖。旧 Web Anchor 测试脚本依赖过时的 Supabase mock 和旧鉴权响应，42 项中 16 项失败，不能作为此次 Kysely 服务验收；本轮没有将它们标成通过，也没有扩大范围重写其测试框架。新增真实数据库测试与小程序识别/播放回归用于覆盖受影响路径。

## 上线边界

本记录不能用于当前上线操作。必须按 [迁移操作手册](content-model-migration-runbook.md) 停止旧应用写入、备份、执行完整迁移并部署配套 Web 与小程序。禁止恢复本文历史上的双模型、按组织切换或兼容 UI 流程；需要回滚时恢复升级前完整数据库及对应应用。

详细运行日志保存在本机 `/tmp/spatial-content-implementation/`；临时目录不是长期审计存储，上线前应将正式演练记录保存到团队约定的位置。

## 后续：本地 3000 数据库修复（2026-10-15）

首轮交付未升级原开发库；3000 服务热更新到新代码后，读取 `workspace.archived_at` 和 `organization.content_model_state` 报缺列。按用户后续报障，已修复本机 `sanlin-dev-db` 的 `55432/sanlin`，未连接生产库。

- 先完整备份到工作区父目录 `.local-db-backups/sanlin-before-content-model-20261015-213139.dump`，并恢复到独立验证库演练成功。
- 发现 10 月 11 日实验结构残留：四张旧场景表、更新触发函数和项目内容模式列。四张表及函数整体迁到 `legacy_scene_20261011` schema，原字段及约束重命名保留；旧迁移账本没有删除。旧表仍保留原有外键，独立 dump 是不受后续业务删除影响的历史备份。
- 在同一事务中完成隔离和 foundation 迁移并登记账本。原 2,037 条 Asset、56 个 Organization、81 个 Workspace，以及实验场景 2 条的原字段逐表 hash 校验一致。**截至 2026-10-15 修复完成时**，56 个组织仍为 legacy，尚未回填或切换 v2；该状态已由下述 2026-10-17 切换结果覆盖。
- 项目角色按新规则归一化为 111 个 editor、12 个 viewer；其中 1 条不属于组织成员的旧分配保留只读并登记隔离，原角色留在 `legacy_role`。
- 重跑 `db:migrate` 返回 up to date。已生成并核对数据库类型；仓库类型继续以标准 fresh schema 生成，不纳入本地归档专用字段。TypeScript 检查通过。
- 刷新用户正在使用的 `localhost:3000/manage` 后，项目选择器与当前项目 20 条素材恢复加载；本次刷新后的服务日志没有新增缺列/缺表错误。

原开发库“未迁移”“56 个组织仍为 legacy”的表述仅描述 2026-10-15 的历史时点，不再代表当前状态。该次隔离 SQL 和原字段校验摘要保存在 `.local-db-backups/`。

## 后续：原开发库内容迁移与切换（2026-10-17）

本机 `localhost:55432/sanlin` 已完成克隆库演练及实际库 backfill、verify、cutover，56 个组织均为 v2；素材、场景与普通浏览器地图核心流程、最终源码检查和夹具归档已完成，未迁移生产环境。迁移 Run ID 为 `1629695b-aebe-4db3-874c-db2422cfd788`；完整备份及证据位于 `/Users/wangzhewei/Working/spatial-memory/.local-db-backups/v2-cutover-20261017-381beb17`。详细清单和例外见 [本地迁移审计](local-content-model-cutover-20261017.md)。

- `cutover-applied.json`、`preservation.json`：2,037 条旧 Asset 的旧业务字段保持一致；迁移生成 2,031 个 AssetVersion、2 个真实编排场景及 1,949 条投放，4 条孤立记录保留。两个归档实验场景原行完全一致。这些是迁移计数，不包含后续恢复的空草稿及已归档的服务、浏览器夹具。清理后最终校验再次通过。
- `team-preservation.json`：81 个项目、123 条项目分配、160 条组织成员关系、135 个标签保持一致；组织除内容模式及切换时间外的字段一致。
- 22 条 Anchor 独立管理，保留 59 条关联内容及其中 21 条无 GPS 内容的识别路径；14 条历史无参考图 Anchor 经审核保留。1,048 个必需受管对象 HEAD 均为 200；32 个不存在的可选 `.m4a` 未伪造为资源。
- `runtime-comparison.json`：440 条运行时返回样本比对通过，两个场景播放内容完全一致；Anchor 识别行单独核对，一条历史链接的缺失配置从未改变的目标地址补齐。
- `service-smoke.json`：同项目素材创建及新版、场景保存发布、创建和发布幂等、固定版本、投放更新、过期锁拒绝及公开运行时读取通过，原素材指纹不变。测试素材、场景及两个投放已归档；本轮未测试跨项目复用。
- `archive-recovery.json`：空草稿 `test` 恢复为 `9f5e798f-a4de-4b83-bf6c-bb63ef140aca`，未发布、未投放；旧 `文字` 包装映射原文字 Asset `22a45c97-f804-47aa-a4a9-ea1ad16c02c1` 及其固定版本、原投放，未伪造 Scene。原文和完整 publication 留在归档及独立备份中。
- 浏览器场景链路已通过：场景 `7f42a953-a87b-4130-be11-ef9f96f26ec3` 添加同一固定版本的两个实例，保存并发布修订 `0aa2dd18-6e76-4ada-9f57-e279ae594c18`，创建投放 `ff9cefb0-8aa3-438c-955c-3712e69130b3`；实际小程序场景 HTTP 接口返回 200 和两个实例。证据为 `browser-acceptance.json`、`browser-scene-runtime.json` 及发布截图。两项浏览器夹具随后通过产品 UI 归档；`browser-fixture-cleanup.json` 确认原素材和原投放仍为 active，已归档测试投放的公开接口返回 404。
- 空场景首次添加模型读取过期资源状态的错误已修复，`scripts/test-scene-add-model.ts` 回归通过，浏览器重新加载后的首次添加也通过。随后加入 `VIEWER_READY` 握手补同步；包含该变更的最终源码已在构建镜像目录完成完整 `npm run check`，退出码为 0，证据为 `final-build-check.log`。`final-verification.json` 确认 709 项镜像清单中的非文档源码及关键源码哈希与最终检查版本一致；`build-check.log` 为前一轮结果。
- 普通 Chrome 地图对照验收通过：通过原生操作，在未由 BrowserTab API 获取或附着的新普通标签中打开实际 `/manage`、Cmd+R 刷新、场景页返回投放地图的客户端导航均正常；可访问性树包含 DJI 地形加载器、CesiumJS iframe、Cesium ion 与 Bing imagery 控件。页面往返后选择旧“小星星⭐️”投放，影像和固定 v1 模型预览正常，证据为 `local3000-native-map.png`、`local3000-native-client-navigation.png`。场景定位、地图点击坐标回传及旧模型详情与预览亦已验证。
- 自动化附着标签的动态 iframe 仍可停在 `about:blank`；纯静态 HTML 延迟添加 iframe、加载轻量 post-message 测试页也复现，不依赖 React、业务代码或 Cesium。对照结果支持自动化附着相关干扰，具体 CDP 机制未证实；这是诊断限制，不作为普通浏览器地图全局失败，也不将普通标签成功归因于重启或 READY 握手。临时公开诊断页和业务绕过代码已移除，诊断标签已关闭，仅保留私有诊断证据。
- 切换后完整备份 `after-cutover.dump` 已保存（2,675,200 字节），`pg_restore --list` 通过，SHA-256 记录于 `after-cutover-backup.json`；迁移前 `before-cutover.dump` 继续保留。切换后备份尚未宣称完成全量恢复演练。

本轮已完成所列素材、场景与普通浏览器地图核心 UI 流程，保留自动化附着标签的 iframe 诊断限制。未执行新文件的实际 OSS 上传、跨项目 UI 复用和真机 GPS、相机、AR 验收；不以场景 HTTP 成功替代这些验证。四条孤立记录后续必须审核归属并通过受控 v2 导入恢复。旧源行及归档原文继续保留；当前已有新版草稿及测试写入，归档夹具不会抹去这些写入，不得切回 legacy 重跑 backfill，后续采用前向修复。
