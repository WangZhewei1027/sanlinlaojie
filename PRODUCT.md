# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

三林老街的 AR 资源管理平台。场景是一种 asset，复用资源的工作区、权限、地图放置和保存流程。

## Users and Operating Context

场景编排以桌面电脑为主，窄屏支持预览和基础编辑（用户确认）。用户可以只输入标题创建空白场景，在独立标签页中添加多个 3D 模型实例、编排变换关键帧、选择模型动画并预览。

## Capabilities and Constraints

首版只编排现有 3D 模型。Theatre.js 驱动时间轴，场景 JSON 同时被小程序播放端消费。保留既有 asset API、权限和场景协议；UI 改版不引入发布层或独立场景表。

## Brand Commitments

场景编辑页参照 Unity 与 Timeline 的交互组织。其他页面继续遵循 docs/design-system.md。
