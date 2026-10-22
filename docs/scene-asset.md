# Scene：保存即生效

Scene 是团队拥有的独立场景。`scene.document` 保存 schema 6 编排，资源别名只引用 `{ assetId }`；实例保存初始 position/rotation/scale、可选数值轨道和 GLB 片段配置；可选 `groups` 是带变换和轨道的父节点（Logic Track Stack 式分组），实例与分组通过 `parent` 组成最多 4 层的层级，`instances` 的顺序即时间轴轨道顺序。`scene_asset_ref` 是同一保存事务重建的依赖索引。Asset 和 Scene 都只有一份当前内容，没有发布或版本切换流程。

## 保存、引用和归档

- 团队 owner/admin/member 可以保存，viewer 只读。保存需要 `expectedLockVersion`：缺少返回 428，冲突返回 409，客户端保留未保存修改。计数器只用于并发控制。
- 保存会验证素材属于同一团队、文件可用、动画名/序号正确。已归档素材可保留原引用，但不能新增引用。
- 地图 Placement 引用 `{ kind: "scene", sceneId }`。保存立即更新所有地图中的场景内容，不改变投放位置、展示配置、状态和并发锁。
- 空场景可以保存和扫码预览；手机提示没有模型。新建 active 投放时要求非空场景和 GPS/匹配点发现路径。
- 归档后停止编辑、直接扫码预览和新增投放；已有投放继续使用保存的场景。恢复后可以继续使用。
- 复制生成独立场景，复用当前素材，不复制投放。创建、导入和复制均不需要地图合集。

## 编辑与二维码

场景库 `/manage/scenes` 打开 `/manage/scenes/[id]`。React 直接组合 Three.js Editor 原生视口、素材与对象侧栏、变换时间轴和标题/保存栏；同一个 `useSceneDocument` 管理内容与最多 60 个过去快照的撤销历史。一次原生变换拖动提交一次；关键帧、素材、片段设置和标题共用历史。播放位置不保存，内容变化才标记未保存，退出时提示。

时间轴提供 position/rotation/scale 的 9 个通道、关键帧增删与拖动改时、线性/缓动/保持插值。旋转字段显示度，存储为 Euler XYZ 弧度；保留多圈值。已有自定义 Bezier 会显示“原有曲线”，编辑数值和时间时保留其 handles。Ctrl/⌘ S 保存、Ctrl/⌘ Z 撤销、Shift Z 重做，空格播放/暂停；W/E/R 切换原生变换，F 聚焦。窄屏侧栏默认收起，时间轴独立滚动；预览保留播放控制并隐藏编辑面板。

工具栏二维码复用地图合集的 WeChat token、OSS 缓存和弹窗组件。入口固定为 `pages/index/index?organizationId=…&sceneId=…`，首页打开 `pages/scene/scene`，不会改变所选地图或地图扫码历史。扫码展示最近保存的内容，未保存时弹窗明确说明。

`POST /api/miniapp/scenes/preview` 接收 `{ scene_id, organization_id }`，只返回未归档团队中的未归档场景。持有二维码即可匿名预览，与地图二维码相同。资源始终解析当前 Asset 文件；响应不缓存。

## 协议与共享 Core

`compileSceneManifest` 将文档 schema 6 与当前资源编译为播放清单：没有分组的场景保持平铺的 schema 4（已发布的小程序只接受它），有分组的场景输出 schema 5。两端从各节点的 `parent` 搭建 Object3D 层级，变换值都相对父分组。`manifest.assetId` 是播放实例标识：地图入口为 Placement ID，直接扫码入口为 Scene ID；资源里的 assetId 才是基础素材 ID。实时 API 与播放器只接受当前协议。

- 实例使用米制 `position`、Euler XYZ 弧度 `rotation` 和 `scale`。可选 `tracks` 的键为 `position.x/y/z`、`rotation.x/y/z`、`scale.x/y/z`；每个关键帧为 `{ time, value, handles: [inX, inY, outX, outY], connectedRight }`，time 单位为秒。相邻帧使用左帧出柄与右帧入柄做 Bezier 插值；`connectedRight: false` 保持到下一帧，精确关键帧时间返回该帧值。没有轨道的通道使用静态姿态。
- 保存限制 1 MiB、8 素材、24 实例、2400 关键帧，时长大于 0 且不超过 600 秒；静态场景可用 null 时长，新场景默认 10 秒。校验允许 Bezier 纵向超调。
- `packages/scene-core` 2.1.0 是 Web 与小程序共用的零依赖源码。接口为 `play/pause/seek/advance/sync/sample/subscribe/observe/bind/dispose`，另提供数值采样和 `clipTime`。宿主负责帧时钟、资源、渲染和编辑历史；Core 不持有全局项目表、DOM、定时器或 RAF。
- 每个播放器独立创建 Core；`dispose()` 停止播放并清空订阅、对象绑定与内容引用。GLB 骨骼/节点动画仍由各端 Three.AnimationMixer 求值，Core 只共享片段时间映射。
- Web 使用本地 npm 包；小程序提交 npm pack 快照与 esbuild 产物。当前小程序压缩 bundle 为 2461 字节（小程序仓库的 `miniprogram/lib/scene-runtime/vendor/build-info.json` 记录版本、源码哈希和字节数）。更新命令见 [Scene Core README](../packages/scene-core/README.md)。

## 播放与原生视口

小程序预览不请求 GPS。模型加载完成并获得有效相机帧后启用“放置场景”，点击时使用最新相机位置和水平朝向，放到前方 2 米、相机高度；轻触场景暂停/继续。后台、错误、销毁会取消待处理结果并释放模型；超过 250ms 的相机帧不能用于放置。回到前台会重新读取保存内容并重新定位。

地图发现沿用 `/api/miniapp/assets/scene`，请求里的 `asset_id` 是投放 ID，并继续校验合集/团队范围；直接场景 ID 不能绕过地图投放状态校验。

`vendor/three-editor` 固定 r183 官方源码；Editor、Viewport、Selector、EditorControls、Toolbar、ViewHelper 和原生变换命令负责视口交互。`app/manage/scenes/components/three-editor/` 将子网格选取映射回实例，将完成的变换写入应用文档历史。模型模板缓存在当前视口按引用释放，关闭时清理 renderer、RAF、监听器和辅助资源。上游来源与补丁见 [集成说明](../vendor/three-editor/README.md)。

仅开放现有协议可保存、两端可播放的能力。原生 Editor 的独立文件/JSON、任意材质/灯光/脚本未开放；层级只能通过时间轴轨道头部的分组编辑，不使用原生大纲树；增加能力应先扩展共享协议和 runtime。

## 一次性迁移

`20261018000000_mutable_scenes.sql` 将历史 scene_revision 引用转为 scene_id，保留当前文档与投放参数，归档旧发布数据后移除运行时版本表。

旧 schema 4/5 由 `scripts/migrate/transform-scenes.ts` 转为 schema 6；旧 Theatre 原生静态覆盖、数值轨道、Bezier handles、hold 与多圈旋转在这里一次性展开到实例。旧格式只存在于迁移代码、历史采样 fixture 和归档中。

运行标准 `npm run db:migrate`：`20261020000000_transform_scenes.sql` 前会在同一迁移事务中调用 `migrateTransformScenes`，把原文和旧锁存入 `migration_archive.transform_scene_source`，转换并校验后增加 `lock_version`，最后加 schema 6 约束。已经是 schema 6 的文档跳过转换。不要单独执行 SQL 跳过 TypeScript 迁移。更早的 `20261019000000_native_theatre_scenes.sql` 仅保留为顺序迁移历史。

## 2026-10-20 当前自动验收

本轮按用户选择使用浏览器与自动化播放器验收。微信开发者工具登录已过期，本轮未重新运行模拟器，也未做真机 AR 或手机进程内存验收。

| 检查 | 结果 |
|---|---|
| 浏览器内容闭环 | 旋转字段输入 90°，撤销/重做、保存/重开通过；恢复 180° 后再次保存/重开通过；关键帧添加、改值、拖动、撤销通过，临时测试改动已全部撤回；实际小程序 API 返回协议 4，同一保存内容两端 Core 采样一致 |
| 迁移数值 | 201 个历史采样，最大旋转误差约 `8.6332e-6` 弧度 |
| 两端实际播放器 | Web 原生适配层与小程序实际 Three/GLTFLoader/AnimationMixer：34 个采样、3303 项矩阵/时间比较，最大误差 0 |
| Web 模型释放 | 100 次带 GLB 动画的原生 Editor 加载/移除，受检几何/材质注册表回空 |
| 小程序 Core | 220 次加载/播放/释放，每场 8 实例、1200 关键帧；受检对象残留 0，Node 强制 GC 后堆约 5.05→5.13 MiB |
| 小程序完整播放器 | 120 次真实 GLB 生命周期，受检播放器、状态、克隆及缓存引用残留 0 |
| 数据库迁移 | 回滚、原文归档、锁递增、重复执行与协议约束测试通过 |
| 完整回归 | Web `npm run check` 与小程序 `npm test` 通过；Web 保留 15 个既有 lint warning |

相关命令：Web `npx tsx scripts/test-scene-core.ts`、`test-scene-hierarchy.ts`、`test-transform-migration.ts`（需测试数据库）、`test-scene-playback-parity.ts`（需相邻小程序仓库）、`test-three-editor.ts`；小程序 `npm run test:scene-memory`。UI 证据在 `.impeccable/review/desktop.png`、`mobile.png`，finish review disposition 为 `ship`。

此前协议 3 的 100 次模拟器 GPU 检查和 10 次 iframe 退出记录属于历史验收，不能作为当前实现的重跑结果。其证据仍在 `/Users/wangzhewei/.codex/visualizations/2026/10/19/01a154ad-3006-74b0-a293-fb8306341ebd/` 的 `scene-memory-*` 与 `three-editor-*` 文件。本轮内存数字仅代表当前 fixture 与运行环境。
