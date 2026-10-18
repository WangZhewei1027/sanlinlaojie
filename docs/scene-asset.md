# Scene：保存即生效

Scene 是团队拥有的独立场景。`scene.document` 保存 schema 4 编排，资源别名只引用 `{ assetId }`，实例包含位置、旋转、缩放、GLB 动画和变换曲线。`scene_asset_ref` 是同一保存事务重建的依赖索引。Asset 和 Scene 都只有一份当前内容，没有发布或版本切换流程。

## 保存、引用和归档

- 团队 owner/admin/member 可以保存，viewer 只读。保存需要 `expectedLockVersion`：缺少返回 428，冲突返回 409，客户端保留未保存修改。计数器只用于并发控制。
- 保存会验证素材属于同一团队、文件可用、动画名/序号正确。已归档素材可保留原引用，但不能新增引用。
- 地图 Placement 引用 `{ kind: "scene", sceneId }`。保存立即更新所有地图中的场景内容，不改变投放位置、展示配置、状态和并发锁。
- 空场景可以保存和扫码预览；手机提示没有模型。新建 active 投放时要求非空场景和 GPS/匹配点发现路径。
- 归档后停止编辑、直接扫码预览和新增投放；已有投放继续使用保存的场景。恢复后可以继续使用。
- 复制生成独立场景，复用当前素材，不复制投放。创建、导入和复制均不需要地图合集。

## 编辑与二维码

场景库 `/manage/scenes` 打开编辑器 `/manage/scenes/[id]`。层级、视口、属性和时间轴共享当前文档。W/E/R 调整变换，Space 播放，Ctrl/⌘+S 保存；未保存修改保留本地，退出会提示。

工具栏的微信二维码复用地图合集的 WeChat token、OSS 缓存和弹窗组件。二维码固定指向 `pages/index/index?organizationId=…&sceneId=…`，首页直接进入 `pages/scene/scene`，不会改变所选地图或地图扫码历史。扫码展示最近保存的内容，未保存时弹窗明确说明。

`POST /api/miniapp/scenes/preview` 接收 `{ scene_id, organization_id }`，只返回未归档团队中的未归档场景。持有二维码即可匿名预览，与地图二维码相同。资源始终解析当前 Asset 文件；响应不缓存。

## 播放

`compileSceneManifest` 将 schema 4 编排和当前资源编译为唯一的播放 schema 2，保留实例、动画和曲线。`manifest.assetId` 是播放实例标识：地图入口为 Placement ID，直接扫码入口为 Scene ID；资源里的 assetId 才是基础素材 ID。

小程序预览不请求 GPS。模型加载与 AR 稳定等待并行，只有有效相机帧连续满 2 秒且模型加载完成后才显示。使用显示瞬间的相机位置和水平朝向，放到前方 2 米、相机高度；轻触场景暂停/继续。后台、错误、销毁会取消待处理结果并释放模型；超过 250ms 的相机帧间断重新计时。回到前台会重新读取保存的内容并重新定位。

地图发现沿用 `/api/miniapp/assets/scene`，请求里的 `asset_id` 是投放 ID，并继续校验合集/团队范围；直接场景 ID 不能绕过地图投放状态校验。

## 迁移与检查

`20261018000000_mutable_scenes.sql` 将旧 scene_revision 引用转为 scene_id，保留当前保存的文档与所有投放参数，归档旧发布数据后删除运行时版本表。详见迁移说明。

测试覆盖迁移、权限、保存冲突、跨合集同步、二维码、后台取消与 2 秒稳定等待。生产 Web 构建使用 Webpack，并解析产出的浏览器 bundle，防止 Theatre 的二次压缩问题；小程序真实相机追踪仍需真机验收。
