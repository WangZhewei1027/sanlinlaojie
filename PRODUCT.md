# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

三林老街的 AR 内容管理平台。Organization 在界面上称为**团队**，是唯一的所有权与权限边界：团队成员共享全部素材、场景和合集。Asset 管理可复用素材与固定版本，Scene 管理作品编排，Placement 管理一次空间投放；Placement 属于一个**地图合集**（存储上仍是 Workspace 行，UUID 与二维码参数不变）。

内容模型按团队迁移。`legacy/preparing` 仍以旧 Asset 模型写入，`readonly` 暂停写入，`v2` 使用新模型；部署代码不等于组织已完成切换。旧模式的 Scene 仍是 `asset.file_type='scene'`。实现入口与迁移边界见 [数据层](docs/data-layer.md) 和 [改造方案](docs/team-assets-scenes-refactor-plan.md)。

## Users and Operating Context

团队成员在桌面电脑上管理内容，窄屏支持浏览、预览和基础编辑（用户确认）。登录后进入**工作台**：团队全部素材和场景在一个缩略图网格中，按类型筛选（用户参照 Kivicube 确认）。上传素材、新建场景都不需要先选合集；把已发布的场景或素材放到地图上时才进入某个地图合集。现场采集在页面内选择目标合集。

用户可以只输入标题创建空白场景，在独立标签页中添加多个 3D 模型实例、编排变换关键帧、选择模型动画并预览。

## Capabilities and Constraints

当前只编排 3D 模型。Three.js Editor 提供原生视口，应用时间轴编辑位置、旋转和缩放；旋转字段显示度，文档保存 Euler XYZ 弧度。场景文档 schema 6 编译为播放 schema 4，由 Web 与小程序共享的零依赖 Scene Core 求值，GLB 内置动画仍由 Three.AnimationMixer 播放。Scene 保存即生效，引用团队 Asset 当前内容；素材更新会在下次加载时反映到场景和投放。

主导航为工作台 / 合集 / 团队设置。工作台承载素材与场景，合集承载空间投放，同一场景可放进多个合集。单张照片或文字可直接投放，无需创建 Scene。权限只看团队角色：owner/admin/member 可编辑，viewer 只读；不再有项目授权、项目成员或维护者门禁，`maintained_by` 仅作信息显示。首期不提供实时多人编辑。前端信息架构见 [团队工作台](docs/team-workbench.md)，服务端规则见 [后端契约](docs/team-workbench-backend-contract.md)。

种树活动仅预留内容解析、业务命令和展示适配边界。没有 Activity、Topic、Reply 或种子账目实现；未来业务内容不塞入 Asset 类型或 Scene JSON。

## Brand Commitments

场景编辑页参照 Unity 与 Timeline 的交互组织。工作台是以缩略图为主的操作型内容库（参照 Kivicube 的功能组织，不做营销页式表达，不虚构统计数据）。其他页面继续遵循 docs/design-system.md。
