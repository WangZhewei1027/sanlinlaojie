# AR 平台调研记录（2026-10-09）

> 状态：**历史记录，保留参考**。本文原为 旧场景组织方案 第 10 节，2026-10-11 拆出。调研针对的是旧方案的“演出协议、时间轴与编辑器嵌入”目标；该路线已被[Scene 素材方案](./scene-asset.md)取代，文中平台与其运行时均不是当前任何阶段的依赖。资料来自旧方案，拆出时未重新逐项核验。**编辑器嵌入、统一多轨编辑以及旧方案的自建路线已不再是实施前提。**


## 1. 候选对比

| 平台 | 已确认的编辑能力 | 输出或接入方式 | 本项目判断 |
|---|---|---|---|
| **Mattercraft（Zapworks）** | 浏览器三维编辑；文字、图片、模型、音视频；关键帧、曲线、状态；模型动画／音视频 Stream Tracks | 基于 Three；可导出完整 Web 项目、发布输出并自托管；场景与动画存于 `.zcomp` | 演出功能最接近目标。尚未查到公开的编辑器嵌入 SDK 或微信原生适配；导出项目不等于普通 Three 可直接加载全部行为 |
| **Galacean Effects Studio** | Web 合成与时间轴、关键帧、文字、图片、3D、粒子及 Web 音视频 | JSON／ZIP 产物；MIT Runtime；Three 插件和微信适配分别存在 | 保留本项目技术栈时值得验证，但微信官方文档明确不支持音视频插件，Three 插件仍以 r149 为基线 |
| **Kivicube** | 浏览器 AR 场景编辑、模型／图片／视频／音频、进入／强调／退出动画和事件触发 | 官方微信小程序插件、高级 API、简易小程序工程导出 | 微信成品集成路径明确，但完整 AR 场景工程不能导出；公开证据不足以认定其具备 Unity 式统一多轨时间轴 |
| **Needle Engine＋Unity／Blender** | 外部编辑场景与 Timeline；运行时支持动画、音频、显隐和信号等轨道 | 基于 Three 的组件运行时与自定义 glTF 扩展 | 适合接受桌面外部编辑的团队；目前不能据此替代管理端内嵌编辑器，微信运行时仍需适配 |
| **Spline** | Web 三维编辑、时间轴与曲线，支持图片、模型、MP4、MP3／WAV 等导入 | 自有 Runtime；GLB 导出只保留受支持的内容 | 可作为外部模型／变换动画制作工具；GLB 不能完整搬运多媒体交互演出 |

## 2. Mattercraft：最接近完整演出编辑平台

官方的 [Stream Tracks 文档](https://docs.zap.works/mattercraft/animation-system/timelines/stream-tracks/) 明确支持把模型内置动画、视频和音频加入时间轴，并提供播放、暂停、停止和跳转控制。[音频文档](https://docs.zap.works/mattercraft/media/audio/) 还确认可以编辑开始／结束时间、源偏移和播放速度。因此其多媒体编排能力不只是“场景里放一个视频”。

[产品页](https://www.zap.works/mattercraft/) 确认 Three 核心、三维文字与可视化动画；[视频文档](https://docs.zap.works/mattercraft/media/videos/) 支持绿幕及左右分区透明视频。项目现有透明视频是上下分区，接入时需转换布局或适配 shader，不能直接认为格式一致。

可[导出项目 ZIP](https://docs.zap.works/mattercraft/getting-started/)，并[下载发布输出自行部署](https://docs.zap.works/mattercraft/previewing-and-publishing/self-hosting/)；自托管文档要求域名授权。其 [`.zcomp` 文件](https://docs.zap.works/mattercraft/getting-started/mattercraft-structure/) 保存场景和动画，运行时使用 ZComponent 组件体系。

对本项目的两条候选路径：

- 外部编辑后，将受支持的节点、属性和媒体片段转换成旧方案的演出协议（当前不采用）；需要先验证 `.zcomp` 数据和导出格式是否足够完整、稳定，以及相应使用条件。
- 尝试移植所需的 ZComponent 运行时模块；需核查 DOM、媒体、资源加载、相机和渲染循环，不能仅凭底层使用 Three 判断适配简单。

公开资料说明的 iframe 嵌入主要是发布后的体验。完整编辑器的嵌入、白标和账号／素材库对接尚未确认，不能列为已支持。

## 3. Galacean Effects：有接入基础，但有明确缺口

[Studio 入门文档](https://www.galacean.com/effects/user/zzip7a) 展示完整时间轴、关键帧和运动曲线；[Runtime](https://github.com/galacean/effects-runtime) 采用 MIT，核实到 2026-09-15 发布了 [2.10.3](https://github.com/galacean/effects-runtime/releases/tag/2.10.3)，仍有近期维护。

[Three 插件](https://github.com/galacean/effects-runtime/tree/main/packages/effects-threejs) 可将产物加载为 `ThreeDisplayObject`，该对象继承 `THREE.Group`，可接收外部 Three 相机。但核查 2.10.3 对应源码时，其 README 和开发依赖仍采用 Three `0.149.0`。这说明 r186 兼容性需要验证，并不直接证明兼容或不兼容。

最重要的限制来自[微信官方适配说明](https://www.galacean.com/effects/user/pq9u1sqdbtugp997)：微信小程序环境暂不支持多媒体（音视频）插件。源码中的多媒体实现也使用 `HTMLVideoElement`、`HTMLAudioElement`、`window.AudioContext`。已有微信适配与已有 Three 插件是两条能力，不能直接组合成“微信＋Three＋音视频全部支持”。

因此可以验证“Galacean 负责已支持的视觉演出，现有微信媒体适配器负责音视频”的路线；但需要能提取或复用其媒体片段时间，并实现统一时钟。否则只会得到两个独立播放器。保留现有动态文字接口也需验证字体、对象定位及内容替换。

Runtime 的 MIT 许可不意味着整个在线 Studio 已开源或可以作为 SDK 私有嵌入。该项在本次公开资料核查中尚未确认。

## 4. Kivicube：微信接入明确，场景数据迁移受限

[快速入门](https://www.kivicube.com/docs/zh/manual/getting-started/quick-start) 确认在线摆放素材、组合、动画效果和事件触发；[微信插件文档](https://www.kivicube.com/docs/zh/manual/custom-development/wechat-miniprogram/mp-ar-plugin-quick-start) 给出原生小程序接入路线。

[官方 FAQ](https://www.kivicube.com/docs/zh/faq/frequently-asked-questions) 明确区分：暂不支持 AR 场景工程导出，可以导出用于集成的简易小程序工程。因此它适合采用平台及其插件来交付内容，不能按“导出演出 JSON 后交给现有 Three 播放”来规划。

其公开教程确认的是预设动画参数、循环与触发条件，尚不足以确认任意属性曲线和模型／音视频统一多轨剪辑。高级 API、去水印与插件使用范围按[套餐说明](https://www.kivicube.com/docs/zh/manual/overview/kivicube-features) 区分，评估成本时应同时检查能力。

如果考虑采用其运行时，需要先验证外部 SAGE 结果触发、相机帧获取、整场清理及现有交互保留；本次没有完成这些验证。

## 5. Spline、Needle 与其他候选

- **Spline**：[时间轴](https://docs.spline.design/designing-in-3-d/animation/timeline-animation) 已支持关键帧与曲线；[导入格式](https://docs.spline.design/basics/faq) 包含模型、图片、音视频。但 [GLB 导出文档](https://docs.spline.design/exporting-your-scene/files/exporting-as-gtlf-glb) 明确只支持位置／旋转／缩放时间轴动画，材质与透明度动画、事件及交互等不能完整导出。完整体验依赖其 Runtime；[自托管输出](https://docs.spline.design/exporting-your-scene/web/exporting-as-self-hosted-project) 当前属于 Enterprise 能力。内容嵌入不等于编辑器嵌入。
- **Needle**：[技术概览](https://engine.needle.tools/docs/technical-overview/) 确认 Three＋组件体系＋自定义 glTF 扩展；[Unity 集成](https://engine.needle.tools/docs/for-unity-developers.html) 是成熟的外部编辑工作流。近期官方维护者在 [2026-09 的讨论](https://forum.needle.tools/t/short-audio-clips-in-unity-timeline-still-play-when-volume-is-0/2890) 中仍说明浏览器 Inspector 尚不能展示 Needle Timeline，因此不能把 Inspector 当成已完成的 Web Timeline 编辑器。
- **易现 EZXR**：[AR 小程序云开放平台](https://www.ezxr.com/ar-weapp) 明确提供在线 AR 内容编辑器、小程序插件和发布链路，但本次公开资料不足以确认完整时间轴、独立导出和编辑器 SDK，作为国内商务候选保留。
- **Onirix**：[Studio 文档](https://docs.onirix.com/onirix-studio) 确认模型、视频、音频、图片和交互制作；完整多媒体时间轴及接入本项目运行时尚未确认，当时不作为首选。
