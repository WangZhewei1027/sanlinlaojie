# Scene 是一种素材

`scene` 与 `model`、`image`、`text` 并列，使用现有 `asset` 表。此次实现不需要数据库迁移。

| 字段 | 含义 |
| --- | --- |
| `file_type` | `scene` |
| `text_content` | scene.json 文本，最大 256 KiB |
| `file_url` | 空；JSON 保存在素材行，不额外上传到 OSS |
| `workspace_id` / `location` / `metadata` | 沿用素材的工作空间、地图位置与坐标 |
| `anchor_id` / `tag_ids` / `name` | 沿用匹配点关联、标签和名称 |

场景只负责多个模型实例的布局和动画时间。普通图片、文字、音视频仍直接作为素材展示，不包装成 single_asset 场景。不建立 scene、revision、资源快照或旧素材转换表，也不切换工作空间展示模式。

## 创建与编辑

1. 在组织设置中开启“场景”和“模型”上传类型。
2. 在素材上传面板选择“场景”，只填标题即可创建。JSON 导入和地图位置均可选。
3. 选择场景素材，点击“编辑”，在独立标签页打开 `/manage/scenes/[id]`。
4. 从左侧“项目素材”拖动模型到场景地面，或点击 + 在原点添加。拖放位置由当前相机投射到 Y=0 地面，超出场景范围时显示不可放置提示。层级、3D 视口、右侧属性、底部时间轴共享选中对象；桌面复用管理页已有的 react-grid-layout（GridItem），拖动分隔条调整两侧窗口宽度和时间轴高度，相邻窗口同步填满可用空间。
5. 用 W/E/R 切换移动、旋转、缩放工具，或在属性中精确输入数值。旋转输入以度显示，保存仍是 XYZ 欧拉角弧度/单位四元数。点击属性菱形添加或删除当前时间的组关键帧；开启录制后，修改数值或拖动工具会记录关键帧。已有动画通道始终在当前时间记录修改。
6. 底部时间轴可定位和拖动播放头、展开变换轨道、拖动关键帧、用方向键逐帧移动关键帧、Delete 删除关键帧、设置总时长和缩放。总时长不能缩短到现有关键帧或片段起点之前。属性面板可选 GLB 动画、开始时间和循环；拖动动画片段调整开始时间，按 30 fps 吸附，松手提交一次可撤销修改，Esc 取消。拖动保持抓取点偏移并适配时间轴缩放；方向键逐帧移动，Shift + 方向键每次移动 10 帧。
7. Space 播放/暂停，F 聚焦全部模型；“预览”隐藏编排面板和辅助网格。窄屏通过“场景 / 对象 / 属性 / 时间轴”切换工作区，支持预览和基础编辑。
8. Ctrl/⌘+Z 撤销、Shift+Z 重做（最多 100 步），Ctrl/⌘+S 保存。输入框保留文本编辑快捷键。关闭未保存页面会提示，播放和选择不改变保存状态。管理页另有“位置与标签”入口。

Theatre.js 0.7.2 仅在独立编辑页加载。编辑器以可移植场景文档维护历史，Theatre 负责变换曲线求值与播放，GLB AnimationMixer 跟随同一播放头。没有第二份持久化项目状态或新表。修改/移动关键帧保留已有贝塞尔控制点与 hold 属性；不持久化面板位置、选中项或游标。

Theatre 的浮动 Studio UI 不再显示。0.7.2 没有公开的运行中替换状态接口，`lib/scene/theatre-authoring.ts` 将唯一内部适配边界限制为 sheet 状态导入；依赖固定为 0.7.2，升级必须验证该适配器及生产浏览器中的加载、修改、撤销、播放和重开。其他组件不接触 Theatre 内部状态。生产构建使用 Webpack：当前 Next 16.0.7 的 SWC 二次压缩 Theatre Studio 0.7.2 自带的已压缩颜色选择器代码时会生成重复的局部变量声明（`let r,r`），导致整个编辑页无法初始化。Webpack 配置仅将 Studio 分入独立 chunk，跳过这份已压缩依赖的二次压缩，其他代码正常优化。`npm run build` 末尾解析全部浏览器 chunk，防止“构建通过、浏览器语法错误”再次漏检；开发服务器仍用原有构建配置。快捷键在捕获阶段接管撤销，避免隐藏的 Studio 重复处理。

新增 `GET /api/assets/[id]` 仅供场景编辑页使用，要求与保存相同的所有所属组织的写权限。返回场景、可选模型和 `scene_revision` 内容指纹。保存携带该指纹；过期返回 409，保留页面上的未保存内容，避免两个标签页互相覆盖。已有普通素材 PATCH 调用无需携带此字段。

旧版布局仍可导入：

```json
{
  "schemaVersion": 1,
  "content": {
    "kind": "composition",
    "units": "meters",
    "durationSeconds": 20,
    "loop": true,
    "assets": {
      "dancer": { "assetId": "00000000-0000-0000-0000-000000000001" }
    },
    "instances": [
      {
        "id": "left",
        "asset": "dancer",
        "position": [-1, 0, 0],
        "quaternion": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "animation": { "clipIndex": 0, "startSeconds": 0, "loop": true }
      },
      {
        "id": "right",
        "asset": "dancer",
        "position": [1, 0, 0],
        "quaternion": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "animation": { "clipIndex": 0, "startSeconds": 3, "loop": true }
      }
    ]
  }
}
```

最多 8 个资源别名、24 个实例、600 秒；位置分量绝对值 ≤ 100 米，缩放分量在 (0, 100]，四元数必须归一化。实例 ID 唯一。`animation` 必须显式写对象或 `null`，`clipIndex` / `clipName` 二选一；只有所有实例都没有动画时，`durationSeconds` 才能为 `null`（静态场景）。未知字段和协议版本拒绝保存。空 `assets` / `instances` 是合法草稿，小程序跳过空场景放置。

编辑器保存 `schemaVersion: 2`，实例可增加 `tracks`，只允许 `position.x/y/z`、`rotation.x/y/z` 和 `scale.x/y/z` 九个数字通道：

```json
"tracks": {
  "position.x": [
    { "time": 0, "value": 0, "handles": [0.5, 0.5, 0.5, 0.5], "connectedRight": true },
    { "time": 4, "value": 2, "handles": [0.5, 0.5, 0.5, 0.5], "connectedRight": false }
  ]
}
```

`handles` 为 Theatre 的归一化贝塞尔控制点 `[leftX,leftY,rightX,rightY]`；`connectedRight: false` 保持当前值直到下个关键帧。时间必须严格递增、不超过演出时长，关键帧总数 ≤ 2400。控制点限定在 [0,1]，禁止越界过冲；带曲线的场景必须有有限时长。小程序通过轻量求值器回放，无 Theatre 运行时依赖。

服务端在创建或修改 JSON 时验证结构和依赖：只允许模型 asset ID，模型必须在场景的每个目标工作空间内，不能嵌套 scene 或直接填任意 URL。动画片段存在性、重名、模型解码能力在小程序实际加载时检查；失败则释放整场已加载资源并报错，不显示残缺场景。模型格式支持范围沿用已有 Three 加载器。

## 接口与生命周期

管理端沿用 `POST /api/workspaces/[id]/assets`、`PATCH /api/assets/[id]`、`DELETE /api/assets/[id]`，写入权限仍是既有 `org.assets.write`。

小程序继续用附近素材与匹配点关联素材列表发现 scene。实际进入素材放置队列时调用：

```text
POST /api/miniapp/assets/scene
{ asset_id, p_workspace_id?, p_organization_id? }
```

至少指定一个范围；两个都指定时同时检查。返回 `{ schemaVersion, assetId, content, resources }`，`resources` 将别名解析成当前模型的 `{ assetId, url }`。结构/依赖错误返回 400，场景不在所选范围返回 404；不缓存历史清单。老客户端忽略未知 scene 类型，现有素材继续正常展示。

场景是 `nodeList` 的一个条目，复用串行队列、内容代次、点击和统一清理。已有容量引擎增加 `scene` 桶（最多 1 场）；整场替换/释放，不单独驱逐子模型。放在加载完成时相机前方 2 米、相机下方 1.4 米，整体朝向跟随当时相机水平朝向，内部按 JSON 米制布局，不归一化模型、不参与斥力。点击暂停/继续，结束后点击重播。切换 GPS/匹配、隐藏页面、退出或替换场景时释放全部实例句柄，迟到结果不挂载。

场景引用的是当前素材，不持有文件副本：替换模型后下次加载使用新 URL；删除或移走模型后场景加载失败。场景删除不删除模型。文件引用计数、用户删除和存储清扫保持原逻辑。模型源素材有 GPS 或匹配点位置时仍会独立展示；仅作场景内部资源的模型应不设置独立展示位置。

跨空间移动/复制继续使用现有素材操作；目标空间需要同时有被引用的模型，否则场景不能加载。没有自动复制依赖或旧素材批量转换。

已存在的实验 scene 表/记录不会自动删除或迁移，新代码不再读写它们。原工作区代码已另行备份，实验数据应按需要单独导出或处理。

## 验证

```sh
node --conditions react-server --import tsx scripts/test-scene-asset.ts
node --conditions react-server --import tsx scripts/test-scene-timeline.ts
node --conditions react-server --import tsx scripts/test-scene-authoring.ts
# 需要本地 dev server 和数据库；创建并清理临时用户/素材
node --conditions react-server --import tsx scripts/test-scene-editor-api.ts
# 仅本地数据库：使用一次性组织、工作空间和素材，结束后清理
node --conditions react-server --import tsx scripts/test-scene-asset.ts --db
npm run typecheck
npm run lint
npm run build
npm run build-storybook
```

小程序运行 `npm test`，包含组合动画、失败回收、过期加载、普通素材共存和容量回归。iOS/Android 真机画面、骨骼动画和资源预算仍需现场验收。
