> 当前实现：scene asset 支持标题创建、独立 Theatre.js 编辑页、3D 模型关键帧和 GLB 动画预览；详见 [scene-asset.md](./scene-asset.md)。以下独立 scene/revision 方案为历史草案，不作为本轮实现要求。

> 历史方案：当前实现已收敛为 [Scene 素材](./scene-asset.md)，本文的独立演出/编辑器路线不再是实施要求。

# 自有轻量演出运行时方案：独立 Asset＋演出 JSON

更新日期：2026-10-11

状态：设计提案，尚未实现。资产独立保存在现有素材库，用一个 JSON 描述整场演出；自有轻量播放器执行 JSON。首版支持 GLB 资产与动画，后续增加音视频，不做 Web 编辑器。

## 1. 目标与范围

用户无需将整场演出合成一个 GLB，也不必重新打包已有素材。复用现有 asset，每场演出上传一份 JSON，描述引用哪些资产、各实例的空间布局和动画播放规则。

术语约定：JSON 是声明式的“演出定义／运行配置”；执行它的 Three.js 播放器才是运行时。JSON 不包含可执行 JavaScript。

目标流程：

> 资产分别上传素材库 → 获取可用资产 ID 与动画信息 → AI／外部工具生成演出 JSON → 上传校验 → 绑定匹配点并发布 → 小程序读取 JSON、按引用加载资产并播放。

第一版播放器上线后，支持范围内的新演出只需发布 JSON；有新素材时另行上传 asset，无需重新发布小程序。新增播放器能力或协议支持仍可能需要客户端发版。

| 首版交付 | 后续扩展 | 不在本方案范围 |
|---|---|---|
| 多个独立 GLB asset 的引用与复用、每个实例的空间变换和所选 clip | 独立音频 asset，随后增加视频 asset | Web 三维编辑器、时间轴编辑器、在线代码编辑器 |
| 统一演出时间、动画开始时间、单次／循环、播放／暂停／继续／重启／结束保持／销毁 | 媒体准备、同步、跳转与更多数据驱动轨道 | 任意用户 JS 执行、通用脚本转换器 |
| 匹配点绑定、不可变 JSON 与资源版本、发布回退 | 实例显隐与变换关键帧、交互按需求扩展 | Babylon 原生运行时、外部平台播放器移植 |

首版每个实例最多选择一个 GLB 内置 clip，正常速度播放；不同实例可以同时或错时播放。首版支持 JSON 中的静态位置／旋转／缩放与 clip 调度，不做 JSON 属性关键帧、clip 混合、裁剪和事件系统。整场 GLB 仍可作为一个普通 asset 使用，但不是必需的交付格式。

## 2. 当前基础与边界

| 已核对的项目基础 | 复用或新增工作 |
|---|---|
| asset 已独立保存 file_url、content_hash、workspace_id 与类型 | JSON 引用现有 asset，发布时解析并冻结文件引用 |
| 同一 asset 可属于多个工作区 | 发布时逐个检查是否可用于演出所属工作区 |
| VisionKit＋Three `0.186.1`、单 WebGL2 画布 | 复用相机、背景、场景与唯一帧循环 |
| `ARRuntime.frame()` 同步相机后调用 `onTick(dt)` 再渲染 | 在现有帧回调内更新演出时间，不增加 RAF |
| `loadGLTF` 与 `ModelCache` 已适配加载、克隆、引用释放 | 同一资源共享加载与缓存，每个实例获得自己的对象树与动画状态 |
| 普通模型 `instantiateModel` 会归一化尺寸并播放全部 clips | 演出独立实例化，应用 JSON 变换，只播放指定 clip |
| `asset.anchor_id` 已支持普通素材与匹配点关系 | 演出另设匹配点绑定；JSON 引用不修改素材原有 anchor_id |
| 地点识别不提供持久化 6DoF 位姿 | 保证演出内部布局，不承诺跨会话贴合同一现实墙面 |

源码入口（两个仓库同在 spatial-memory 工作区）：

- 小程序渲染：`xr-frame-plant-trees/miniprogram/lib/three-runtime/ar-runtime.js`。
- 资源与缓存：`miniprogram/lib/three-runtime/resources.js`。
- 当前模型行为：`miniprogram/components/xr-start/assets/model.js`。
- 帧更新与识别：`miniprogram/components/xr-start/index.js`、`matching/`。
- Three 导出子集：`scripts/xr-three/entry.mjs`；新增 API 时修改源文件并重新构建。
- Web：[素材类型](../app/manage/types.ts)、[匹配点机制](./anchor-matching.md)、[小程序 API](./miniapp-api.md)、[资源生命周期](./asset-storage-lifecycle.md)。

当前 asset 行是可修改记录，并不存在可直接依赖的通用 assetVersion 表。不可变资源引用需在演出发布流程新增；不能仅保存 assetId 后实时读取其最新 file_url。

当前加载器拒绝必需的 Draco／Meshopt 压缩，并拒绝没有备用普通纹理的 KTX2 资源。首版单个模型 asset 使用未压缩 GLB 与内嵌 PNG/JPEG 纹理；其他格式按独立样例验证后开放。**模型内部纹理内嵌，不等于将演出的所有资产合成一个文件。**

## 3. 数据模型与轻量运行时

三个核心概念：

- **资产 asset**：独立保存的原始资源，可以被多个演出引用。
- **实例 instance**：某个资产在演出中的一次使用。同一 asset 可以有多个实例，各自有变换、clip 和播放进度。
- **演出 performance**：一份 JSON 将资产引用、实例列表与统一播放时间组合起来。

建议新增 `miniprogram/lib/performance-runtime/`：

| 模块 | 职责 |
|---|---|
| 协议校验 | 检查 schemaVersion、资源引用、实例 ID、变换与动画规则 |
| 资源解析 | 按已发布资源快照获取 GLB，去重加载，限制并发和处理取消 |
| 实例构建 | performanceRoot 下为每个实例建 instanceRoot，再挂载独立克隆模型 |
| 演出播放器 | 维护统一时间，每个有动画的模型实例有独立 mixer／action |
| 场景接入 | 放置根节点，接入帧更新、后台与跟踪生命周期 |

JSON 与播放器均由项目掌控，Three.js 和 VisionKit 提供现有渲染与跟踪能力。客户端读取发布后的 JSON 和资源表，不执行 AI 生成的源码，不引入双引擎。

## 4. 演出 JSON v1（拟定，尚未实现）

用户只提交 `performance.json`，无需 ZIP 或完整场景 GLB。下面的 UUID 为示意，需要替换成素材库中有权限使用的真实 asset ID：

```json
{
  "schemaVersion": 1,
  "units": "meters",
  "durationSeconds": 12,
  "loop": false,
  "assets": {
    "stage": { "assetId": "11111111-1111-4111-8111-111111111111" },
    "dancer": { "assetId": "22222222-2222-4222-8222-222222222222" }
  },
  "instances": [
    {
      "id": "stage-center",
      "asset": "stage",
      "position": [0, 0, 0],
      "quaternion": [0, 0, 0, 1],
      "scale": [1, 1, 1],
      "animation": null
    },
    {
      "id": "dancer-left",
      "asset": "dancer",
      "position": [-1, 0, 0],
      "quaternion": [0, 0, 0, 1],
      "scale": [1, 1, 1],
      "animation": { "clipIndex": 0, "startSeconds": 0, "loop": false }
    },
    {
      "id": "dancer-right",
      "asset": "dancer",
      "position": [1, 0, 0],
      "quaternion": [0, 0, 0, 1],
      "scale": [0.8, 0.8, 0.8],
      "animation": { "clipIndex": 0, "startSeconds": 3, "loop": true }
    }
  ]
}
```

该例只加载舞台与舞者两份源资源，创建三个实例。两名舞者共享源文件，但空间变换和播放时间独立。

协议约定：

- `assets` 是当前 JSON 内的资源别名表；`instances[].asset` 引用别名，不能包含任意 URL。v1 只允许现有 `model` 类型的 GLB asset。
- `instances[].id` 在演出内唯一，首版为扁平列表，无父子引用或跨实例依赖。
- 采用右手坐标、Y 向上、米制位置；quaternion 顺序为 x/y/z/w，须为有效单位四元数。scale 为有限正数，不自动做最长边归一化，也不读取 asset 的普通展示缩放配置。
- instanceRoot 承担 JSON 变换；模型内部动画只影响子树，不覆盖该实例变换和演出的世界放置。
- `animation: null` 表示按模型原始姿态静态展示。非空时，clipIndex 为 GLB animations 数组零基索引，必须存在且有有效轨道、有限正时长。
- `durationSeconds` 为有限正数，是整场演出的时长；startSeconds 满足 0 ≤ startSeconds < durationSeconds。JSON v1 严格校验字段、实例数量及整体资源预算。
- 首版所有实例从演出开始就可见。设置动画开始时间不表示延迟显现：开始前显示该 clip 的第 0 秒姿态；显隐编排以后单独扩展。
- 对已开始的动画，用统一演出时间 t 减去 startSeconds 得到局部播放时间。非循环 clip 播完保持末帧，循环 clip 按自身时长循环；所有实例都随演出暂停。
- 演出 loop=false 时在 durationSeconds 冻结整场最终姿态；loop=true 时整场回到 t=0，各实例重置。场内 clip 即使设为循环，也受演出总时长约束。
- 演出时长短于某 clip 的播放区间时，在演出末尾冻结当时姿态，发布校验提示截断。实现需明确求值到最终时刻，避免因少一帧丢失结束状态。
- 不提供可执行表达式、任意脚本、动态材质或事件回调。音视频到后续协议版本再增加。

发布版仍是一份 JSON：服务端在校验后将 assets 中每个 assetId 补充为不可变的 resourceRef、contentHash、类型及必要元数据，并记录内容版本。实例仍引用别名；物理文件独立保存在 OSS，不嵌入 JSON。JSON 内的资源引用与返回地址由服务端生成。

## 5. 播放与生命周期

宿主内部接口建议为：

| 接口 | 行为 |
|---|---|
| `load(versionRef)` | 校验 JSON，去重加载全部所需资产，创建实例和初始姿态，完成后进入 ready |
| `play()` | ready 时从 t=0 开始；paused 时继续 |
| `pause()` | 冻结演出时间与所有实例姿态 |
| `restart()` | 统一回到 t=0，复位所有实例与动画，再开始播放 |
| `update(deltaSeconds)` | 仅在 playing 时推进统一时间并更新全部实例，由宿主每帧调用一次 |
| `dispose()` | 取消加载、移除演出根节点、停止动画并释放全部实例句柄；可重复调用 |

状态为 loading、ready、playing、paused、ended、error、disposed。即使全部实例静态，也按演出总时长管理播放状态，无动画实例不创建 mixer。ended 后由 restart 重播。

首版所有资源均为必需：全部加载并完成实例化后再展示并启动时钟，不因资源到达顺序不同导致动画错位。某一资源失败则整场进入 error，清理本次已获得的实例句柄，允许整体重试，不悄悄遗漏资产。

每个实例独立持有对象树、骨架和动画状态；底层不可变几何、材质、纹理可共享。同一源 asset 出现多次时复用下载与缓存，每个实例各自 acquire/release，不把多个实例都挂到同一个 Object3D。缓存按不可变资源标识或稳定对象 URL 去重，不按会变化的临时访问参数区分资源。

必须处理：

- 后台或跟踪暂时不可用时暂停，恢复时仅继续此前正在播放的演出，不覆盖用户主动暂停；重设时间基准，避免跳时。
- 跟踪坐标系重建、位移清场、切换匹配点或退出时销毁整场。首版同一 AR 体验最多激活一场演出。
- 每次加载关联 generation／取消标记；迟到的单个资产结果只能释放，不能重新挂回已退出演出。
- 多资源部分加载失败也释放所有已获取句柄；正常销毁停止／uncache mixer，按缓存所有权清理实例骨架并 release，共享几何／材质／纹理由缓存管理。
- 不释放宿主 renderer、相机或仍被其他引用使用的资源。
- 诊断定位到内容版本、实例 ID 和资源别名，明确区分资源加载错误与动画配置错误。

## 6. 发布快照、资产复用与空间放置

草稿可以只引用 assetId；平台导出给 AI 的资产目录应包含类型、名称、米制尺寸提示、clip 索引／名称／时长与当前 contentHash，便于生成正确 JSON。

发布不能只保存可变的 assetId：

1. 检查每个资产属于演出可用工作区、调用者有发布和引用权限，类型与文件符合 v1。
2. 解析当前内容哈希、OSS 对象与动画元数据，校验全部实例，形成一致的资源快照。
3. 将校验和提交之间发生的资产替换／删除视为冲突，要求重新解析校验；提交时再次检查资源标识与权限，不混入新旧文件。
4. 在发布事务中记录不可变 JSON、资源引用与内容版本，原子切换演出已发布版本指针。
5. 替换某 asset 文件后，旧演出仍引用旧对象；重新发布演出才能采用新素材。只调整 JSON 布局无需复制模型文件。

建议新增演出记录、不可变演出版本、匹配点绑定与版本资源引用表。版本资源引用保存不可变对象标识及内容哈希；不能随 asset 行删除级联丢失。现有替换、删除、用户／组织清理和 OSS 清扫逻辑都需纳入此引用关系，防止回收仍被保留版本使用的文件。物理对象只有在普通素材与所有保留版本均无引用后才可清理。整个租户删除时的演出版本移除顺序须一并处理。

运行中的演出维持原版本；下次匹配／加载读取新版本，回退则切换到保留的旧版。asset 的改名和普通展示配置变化不会改变已发布演出。资源归属由工作区权限判断，不从 OSS 文件路径推断。

首版放置采用“识别时相机水平前方的固定原点”，距离由平台统一配置。记录相机快照，资源到达后沿用该快照；加载中原点失效或清场则取消。平面命中放置以后扩展。

结构为 `VisionKit 世界 → performanceRoot → 各 instanceRoot → GLB 模型子树`。不叠加普通素材的随机散布、斥力、浮动或默认旋转，不更改源 asset 地理位置或 anchor_id。

后台仅增加资产目录导出、JSON 上传／校验、绑定、发布与回退操作，不做 Web 编辑器。没有演出绑定的匹配点继续旧素材逻辑；有绑定时只播演出，失败明确提示并允许重试，不自动混播旧素材。旧客户端维持原接口行为，新增信息采用向后兼容字段或独立接口。

## 7. AI 与外部创作工具

首个创作入口是：向 AI 提供 v1 schema 和可用资产目录，让它直接生成 performance.json。已有模型无需再次导出。缺少模型时，再用 Three.js／Babylon.js、外部编辑器或其他工具生成独立 GLB，先上传为 asset，再在 JSON 中引用。

提供：

1. JSON schema、示例演出及资产目录导出格式。
2. “同一 asset 两个实例，错时播放”的最小示例。
3. Three／Babylon 的独立 GLB 导出样例，用于新增模型，不要求生成完整场景程序。
4. 最小预览或检查工具，解析同一 JSON 和资源引用；不建设编辑面板。
5. 可读的校验反馈，让 AI 根据缺失资源、非法 clip 或不支持字段修正 JSON。

提示词核心约定：

> 根据提供的资产目录和 v1 schema 生成 performance.json。资产独立保存，只引用目录内允许使用的 assetId；为每次使用创建唯一 instance，设置米制位置、四元数、缩放、动画 clip 与开始时间。可复用同一 asset，不合并 GLB，不输出 JS 或任意资源 URL。首版只支持模型与动画，缺少所需素材或能力时明确指出。

GLB 内部动画支持目标是节点位置／旋转／缩放、骨骼与 morph，须逐项通过真机样例。任意脚本、粒子、物理、自定义 shader 或外部编辑器专有行为不会自动进入演出 JSON。转换支持范围之外的效果需改写或等待播放器扩展。

Three／Babylon 都是可选资产来源，不需要在小程序部署各自的完整生成工程。只有相应导出样例验证通过后才对外宣称兼容该来源。[Three GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)、[Babylon glTF Exporter](https://doc.babylonjs.com/features/featuresDeepDive/Exporters/glTFExporter/)。

## 8. 实施顺序与验收

| 阶段 | 工作内容 | 验收门槛 |
|---|---|---|
| A：协议与目录 | v1 JSON schema、资产目录、至少两个独立模型与重复实例示例 | 实例 ID／别名／clip／变换可校验，性能预算包含全部实例 |
| B：轻量播放器 | 多资源加载、独立实例、统一演出时间、动画错时播放 | 同一 asset 的实例布局与动画独立，暂停／继续／重启／结束正确 |
| C：空间接入 | 匹配点触发、快照原点、帧更新与取消 | 共用现有相机与帧循环，加载中退出无晚到节点 |
| D：发布与生命周期 | JSON 上传、权限、资源快照、原子发布、回退与清扫引用 | 仅修改 JSON 即可发布新演出；替换／删除源 asset 不破坏保留版本 |
| E：用户创作验证 | AI 生成 JSON、错误反馈、可选 GLB 导出样例 | 用户复用已有资产独立完成发布，无需合并 GLB、编辑器或客户端发版 |

首版完成判断：用户上传一份引用独立资产的 JSON，就能在真实地点播放新演出；不能以单个模型渲染成功代替整场交付。

必要检查：

- 两个独立模型加同一模型的两个实例，下载／缓存去重，位置、缩放和动画时间相互独立。
- 动画延迟启动前显示第 0 秒姿态；单次末帧、实例循环、整场循环与结束冻结符合 JSON。
- 暂停／恢复不跳时，restart 同时复位所有实例；仅选定 clip 播放。
- 资产不存在、越权、类型不支持、clip 非法、未知协议和资源损坏有明确失败。
- 发布期间资源替换引发冲突；发布后资源替换不改变旧演出；回退可读取全部旧资源。
- 部分资源已加载时失败、退出或切换，不遗留实例或缓存引用；重复运行资源占用稳定。
- 释放一个实例不破坏另一个；同一资产在多个保留版本被引用时不会提前回收。
- iOS／Android 验证整体米制布局、轴向、骨骼／morph 动画与基础材质。

实施时为 JSON 校验、统一时间、生命周期、发布冲突和资源引用增加针对性测试；复用小程序 `npm test`。管理端新增上传发布 UI 时按 AGENTS.md 执行 typecheck、lint、build、build-storybook。性能阈值在设备基线测量后确定，既限制源资源总量，也限制实例和同时播放动画数量。

## 9. 后续音视频扩展

沿用“独立资产＋实例＋统一时间”的结构：

1. **音频**：assets 引用现有音频资产，在新版本协议增加音频实例或播放轨道，定义开始时间、音量、循环、准备和释放。
2. **视频**：引用独立视频资产，增加显示平面、媒体适配与播放控制，复用已有视频纹理能力。
3. **同步**：沿用首版的统一演出时间，增加媒体准备、必要时整场暂停、恢复校正和跳转语义；不要让各媒体独立计时。

客户端加载前检查协议版本与能力，v1 演出继续可播放；不支持音视频的新版本不能被旧客户端忽略媒体后残缺播放。JSON 属性关键帧、显隐和事件按真实需求另行扩展。

音视频也独立存储，由发布版 JSON 引用不可变资源，不合成一个“完整演出文件”，不引入 Web 编辑器、任意脚本或双引擎。

本次仅更新方案文档；未实现播放器、JSON schema、接口、数据库迁移或发布功能。

## 10. 历史平台调研（2026-10-09，保留参考）

以下资料来自旧方案，保留用于了解外部创作和导出工具；未在本轮重新逐项核验。**编辑器嵌入、统一多轨编辑以及旧方案的自建路线已不再是当前实施前提。** 下文涉及演出协议、时间轴与编辑器目标的分析只表示当时的评估背景；当前范围以第 1—9 节为准；这些平台与其运行时均不是首版依赖。

### 10.1 候选对比

| 平台 | 已确认的编辑能力 | 输出或接入方式 | 本项目判断 |
|---|---|---|---|
| **Mattercraft（Zapworks）** | 浏览器三维编辑；文字、图片、模型、音视频；关键帧、曲线、状态；模型动画／音视频 Stream Tracks | 基于 Three；可导出完整 Web 项目、发布输出并自托管；场景与动画存于 `.zcomp` | 演出功能最接近目标。尚未查到公开的编辑器嵌入 SDK 或微信原生适配；导出项目不等于普通 Three 可直接加载全部行为 |
| **Galacean Effects Studio** | Web 合成与时间轴、关键帧、文字、图片、3D、粒子及 Web 音视频 | JSON／ZIP 产物；MIT Runtime；Three 插件和微信适配分别存在 | 保留本项目技术栈时值得验证，但微信官方文档明确不支持音视频插件，Three 插件仍以 r149 为基线 |
| **Kivicube** | 浏览器 AR 场景编辑、模型／图片／视频／音频、进入／强调／退出动画和事件触发 | 官方微信小程序插件、高级 API、简易小程序工程导出 | 微信成品集成路径明确，但完整 AR 场景工程不能导出；公开证据不足以认定其具备 Unity 式统一多轨时间轴 |
| **Needle Engine＋Unity／Blender** | 外部编辑场景与 Timeline；运行时支持动画、音频、显隐和信号等轨道 | 基于 Three 的组件运行时与自定义 glTF 扩展 | 适合接受桌面外部编辑的团队；目前不能据此替代管理端内嵌编辑器，微信运行时仍需适配 |
| **Spline** | Web 三维编辑、时间轴与曲线，支持图片、模型、MP4、MP3／WAV 等导入 | 自有 Runtime；GLB 导出只保留受支持的内容 | 可作为外部模型／变换动画制作工具；GLB 不能完整搬运多媒体交互演出 |

### 10.2 Mattercraft：最接近完整演出编辑平台

官方的 [Stream Tracks 文档](https://docs.zap.works/mattercraft/animation-system/timelines/stream-tracks/) 明确支持把模型内置动画、视频和音频加入时间轴，并提供播放、暂停、停止和跳转控制。[音频文档](https://docs.zap.works/mattercraft/media/audio/) 还确认可以编辑开始／结束时间、源偏移和播放速度。因此其多媒体编排能力不只是“场景里放一个视频”。

[产品页](https://www.zap.works/mattercraft/) 确认 Three 核心、三维文字与可视化动画；[视频文档](https://docs.zap.works/mattercraft/media/videos/) 支持绿幕及左右分区透明视频。项目现有透明视频是上下分区，接入时需转换布局或适配 shader，不能直接认为格式一致。

可[导出项目 ZIP](https://docs.zap.works/mattercraft/getting-started/)，并[下载发布输出自行部署](https://docs.zap.works/mattercraft/previewing-and-publishing/self-hosting/)；自托管文档要求域名授权。其 [`.zcomp` 文件](https://docs.zap.works/mattercraft/getting-started/mattercraft-structure/) 保存场景和动画，运行时使用 ZComponent 组件体系。

对本项目的两条候选路径：

- 外部编辑后，将受支持的节点、属性和媒体片段转换成旧方案的演出协议（当前不采用）；需要先验证 `.zcomp` 数据和导出格式是否足够完整、稳定，以及相应使用条件。
- 尝试移植所需的 ZComponent 运行时模块；需核查 DOM、媒体、资源加载、相机和渲染循环，不能仅凭底层使用 Three 判断适配简单。

公开资料说明的 iframe 嵌入主要是发布后的体验。完整编辑器的嵌入、白标和账号／素材库对接尚未确认，不能列为已支持。

### 10.3 Galacean Effects：有接入基础，但有明确缺口

[Studio 入门文档](https://www.galacean.com/effects/user/zzip7a) 展示完整时间轴、关键帧和运动曲线；[Runtime](https://github.com/galacean/effects-runtime) 采用 MIT，核实到 2026-09-15 发布了 [2.10.3](https://github.com/galacean/effects-runtime/releases/tag/2.10.3)，仍有近期维护。

[Three 插件](https://github.com/galacean/effects-runtime/tree/main/packages/effects-threejs) 可将产物加载为 `ThreeDisplayObject`，该对象继承 `THREE.Group`，可接收外部 Three 相机。但核查 2.10.3 对应源码时，其 README 和开发依赖仍采用 Three `0.149.0`。这说明 r186 兼容性需要验证，并不直接证明兼容或不兼容。

最重要的限制来自[微信官方适配说明](https://www.galacean.com/effects/user/pq9u1sqdbtugp997)：微信小程序环境暂不支持多媒体（音视频）插件。源码中的多媒体实现也使用 `HTMLVideoElement`、`HTMLAudioElement`、`window.AudioContext`。已有微信适配与已有 Three 插件是两条能力，不能直接组合成“微信＋Three＋音视频全部支持”。

因此可以验证“Galacean 负责已支持的视觉演出，现有微信媒体适配器负责音视频”的路线；但需要能提取或复用其媒体片段时间，并实现统一时钟。否则只会得到两个独立播放器。保留现有动态文字接口也需验证字体、对象定位及内容替换。

Runtime 的 MIT 许可不意味着整个在线 Studio 已开源或可以作为 SDK 私有嵌入。该项在本次公开资料核查中尚未确认。

### 10.4 Kivicube：微信接入明确，场景数据迁移受限

[快速入门](https://www.kivicube.com/docs/zh/manual/getting-started/quick-start) 确认在线摆放素材、组合、动画效果和事件触发；[微信插件文档](https://www.kivicube.com/docs/zh/manual/custom-development/wechat-miniprogram/mp-ar-plugin-quick-start) 给出原生小程序接入路线。

[官方 FAQ](https://www.kivicube.com/docs/zh/faq/frequently-asked-questions) 明确区分：暂不支持 AR 场景工程导出，可以导出用于集成的简易小程序工程。因此它适合采用平台及其插件来交付内容，不能按“导出演出 JSON 后交给现有 Three 播放”来规划。

其公开教程确认的是预设动画参数、循环与触发条件，尚不足以确认任意属性曲线和模型／音视频统一多轨剪辑。高级 API、去水印与插件使用范围按[套餐说明](https://www.kivicube.com/docs/zh/manual/overview/kivicube-features) 区分，评估成本时应同时检查能力。

如果考虑采用其运行时，需要先验证外部 SAGE 结果触发、相机帧获取、整场清理及现有交互保留；本次没有完成这些验证。

### 10.5 Spline、Needle 与其他候选

- **Spline**：[时间轴](https://docs.spline.design/designing-in-3-d/animation/timeline-animation) 已支持关键帧与曲线；[导入格式](https://docs.spline.design/basics/faq) 包含模型、图片、音视频。但 [GLB 导出文档](https://docs.spline.design/exporting-your-scene/files/exporting-as-gtlf-glb) 明确只支持位置／旋转／缩放时间轴动画，材质与透明度动画、事件及交互等不能完整导出。完整体验依赖其 Runtime；[自托管输出](https://docs.spline.design/exporting-your-scene/web/exporting-as-self-hosted-project) 当前属于 Enterprise 能力。内容嵌入不等于编辑器嵌入。
- **Needle**：[技术概览](https://engine.needle.tools/docs/technical-overview/) 确认 Three＋组件体系＋自定义 glTF 扩展；[Unity 集成](https://engine.needle.tools/docs/for-unity-developers.html) 是成熟的外部编辑工作流。近期官方维护者在 [2026-09 的讨论](https://forum.needle.tools/t/short-audio-clips-in-unity-timeline-still-play-when-volume-is-0/2890) 中仍说明浏览器 Inspector 尚不能展示 Needle Timeline，因此不能把 Inspector 当成已完成的 Web Timeline 编辑器。
- **易现 EZXR**：[AR 小程序云开放平台](https://www.ezxr.com/ar-weapp) 明确提供在线 AR 内容编辑器、小程序插件和发布链路，但本次公开资料不足以确认完整时间轴、独立导出和编辑器 SDK，作为国内商务候选保留。
- **Onirix**：[Studio 文档](https://docs.onirix.com/onirix-studio) 确认模型、视频、音频、图片和交互制作；完整多媒体时间轴及接入本项目运行时尚未确认，不作为本轮首选。
