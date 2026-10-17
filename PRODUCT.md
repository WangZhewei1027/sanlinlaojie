# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

三林老街的 AR 内容管理平台。Organization 管理团队与素材所有权，Workspace 对外称为项目；Asset 管理可复用素材与固定版本，Scene 管理作品编排，Placement 管理一次空间投放。

内容模型按组织迁移。`legacy/preparing` 仍以旧 Asset 模型写入，`readonly` 暂停写入，`v2` 使用新模型；部署代码不等于组织已完成切换。旧模式的 Scene 仍是 `asset.file_type='scene'`。实现入口与迁移边界见 [数据层](docs/data-layer.md) 和 [改造方案](docs/team-assets-scenes-refactor-plan.md)。

## Users and Operating Context

场景编排以桌面电脑为主，窄屏支持预览和基础编辑（用户确认）。用户可以只输入标题创建空白场景，在独立标签页中添加多个 3D 模型实例、编排变换关键帧、选择模型动画并预览。

## Capabilities and Constraints

当前只编排 3D 模型。Theatre.js 驱动时间轴；v2 草稿固定引用 AssetVersion，发布生成不可变 SceneRevision，运行时编译为小程序支持的 schema 1/2。共享素材更新不会自动改变其他草稿或投放，使用者主动升级。

素材库、场景列表与投放地图分别承载素材复用、作品编排和空间管理。单张照片或文字可直接投放，无需创建 Scene。组织角色、项目角色、素材使用授权与维护权分别校验；首期不提供实时多人编辑。

种树活动仅预留内容解析、业务命令和展示适配边界。没有 Activity、Topic、Reply 或种子账目实现；未来业务内容不塞入 Asset 类型或 Scene JSON。

## Brand Commitments

场景编辑页参照 Unity 与 Timeline 的交互组织。其他页面继续遵循 docs/design-system.md。
