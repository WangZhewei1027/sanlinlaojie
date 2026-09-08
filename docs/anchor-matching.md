# 匹配点与小程序混合识别

`asset.file_type = 'anchor'` 保持兼容，管理端展示为「匹配点」。每个匹配点先存一张参考图片，使用现有 `asset.file_url`、`content_hash`；子素材通过现有 `anchor_id` 关联。匹配只代表识别到附近地点，不提供相机 6DoF 或厘米级 AR 重定位。

## 管理端

1. 在具体工作空间中新建「匹配点」，填写名称、地图位置和一张 JPEG/PNG/WebP 图片。参考图按 1 MiB 目标压缩，上限 4 MiB。
2. 保存后服务端尝试生成特征。图片保存与特征生成分离：模型暂不可用时保留图片，在编辑器中显示未配置、待生成或失败状态；可点击「生成 / 更新匹配特征」重试。
3. 匹配点详情列出挂载素材，可选择当前工作空间中尚未挂载的素材，或取消挂载。也可在素材编辑器的「关联匹配点」中指定。
4. 复制出来的匹配点需要生成特征；更换模型版本后逐个更新受影响的参考特征。结构迁移保留现有匹配点与挂载关系，不再包含早期方案中的旧 anchor 批量清理。

更新参考图只处理该点的新图。修改名称、位置或挂载关系不需要重新编码。镜像中不放图库，识别过程中不下载参考图。

## 接口访问方式

识别相关接口按当前方案公开调用，无需登录 Cookie、用户 Token、apikey 或工作空间授权名单：

- `POST /api/miniapp/anchors/recognize?workspace_id=<uuid>`：现场图片识别，匹配成功返回该点挂载素材。
- `GET /api/assets/<anchor_id>/matching`：参考特征状态。
- `POST /api/assets/<anchor_id>/matching`：生成 / 重建已存参考图的特征。

路由代理只对这三个接口对应的精确路径跳过网页登录跳转，其他资产管理接口维持原有权限。公开生成接口仍只处理数据库中已存在的匹配点，图片 URL 必须来自项目 assets 桶。识别参数、定位时效、图片大小、模型版本、阈值和现有工作空间限流仍会校验。公开识别意味着知道 workspace_id 的调用方可获取命中点的挂载素材，生成接口可触发模型计算。

## 数据库与环境变量

`supabase/migrations/20260908000000_anchor_matching.sql` 增加私有特征表、工作空间请求限流表、服务端 RPC 和引用校验触发器；asset 字段、类型值、旧 RPC 保持兼容。整个迁移在事务中执行，失败回滚，不自动生成参考特征。

2026-09-09 修复线上 503 时，确认该迁移从未执行，但管理端已录入新匹配点，因此从尚未应用的迁移中移除了早期的批量删除 anchor 和解除挂载语句。已通过 CLI 单独执行此迁移，并将 `20260908000000` 登记为已应用。执行前后均为 15 个匹配点、52 个挂载素材，未清理现有数据。其他环境执行前仍需检查迁移历史，不要重复建表。

已用线上 REST schema 和数据库查询确认：`asset.id` / `workspace.id` 为 UUID，`workspace_id` 是 UUID 数组；附近匹配 RPC 已能在真实数据库执行。`location` 沿用项目的 WGS84 点，查询显式设为 SRID 4326 后转换 geography 计算米。

服务端配置（不要将 service role 或 EAS Token 写入小程序）：

```dotenv
SAGE_EAS_ENDPOINT=https://你的EAS网关/api/predict/你的服务名
SAGE_EAS_TOKEN=控制台提供的Token
# 必填：用实际正负样本校准，不提供通用到达阈值默认值。
SAGE_MATCH_THRESHOLD=填写校准后的余弦相似度阈值
# 工程初值，前两名分差不足则判为不确定；需要实测调整。
SAGE_MATCH_MARGIN=0.03
```

同时需要项目现有的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和有效 `SUPABASE_SERVICE_ROLE_KEY`。EAS 需使用 ai-location 项目当前的 `POST /embed` 服务，返回 `sage_vitb` 的 8448 维向量及 `embedding_version`。EAS Token 以原值置入 Authorization，不加 Bearer。

新增表仍只允许 service_role 直接访问。公开接口在服务端通过 service_role 读取/生成特征；小程序不连接该私有表，也不会收到特征向量。EAS Token 继续仅用于管理端到模型服务的内部调用。`ANCHOR_PUBLIC_WORKSPACE_IDS` 已不参与识别鉴权，无需配置。

## 新 API

### `POST /api/miniapp/anchors/recognize?workspace_id=<uuid>`

小程序通过 `wx.uploadFile` 发 multipart/form-data，无需管理端 Cookie。必须传具体工作空间，不能传全部组织范围。

此接口不检查 Cookie、Authorization 或 apikey。直接上传图片和以下参数即可。

| 字段 | 类型 | 要求 |
|---|---|---|
| `image` | 文件 | 一张现场 JPEG/PNG/WebP，最大 4 MiB |
| `latitude` | 字符串数值 | -90～90 |
| `longitude` | 字符串数值 | -180～180 |
| `accuracy` | 字符串数值 | GPS 精度估计，0～100 米；更差时请重新定位 |
| `gps_timestamp` | 字符串数值 | 定位采样的 Unix 毫秒时间，过去 30 秒内；不能用上传时间替换旧定位时间 |
| `coordinate_system` | 字符串 | 固定 `wgs84`，小程序使用 `wx.getLocation({ type: 'wgs84' })` |

GPS 候选半径 `min(200, max(75, 2 × accuracy))` 米，是待实测的召回参数，不是到达精度。先筛候选，再编码当前图一次，在已准备好且相同版本的参考特征中计算余弦相似度。分数超过服务端阈值、且与第二名差距足够时返回匹配点及其子素材。没有附近候选时不调用模型。

参考图缺失或未就绪、版本不一致、分数不足、场景混淆等均不返回素材。附近候选中存在未完成特征的竞争点时也暂停匹配，避免静默忽略它造成误匹配。查询最多接受 200 个候选，超出返回 422；每个工作空间共享 30 次/分钟限额，跨进程生效。限额包括未匹配请求，繁忙重试请退避。

成功响应结构（字段值仅示意）：

```json
{
  "data": {
    "matched": true,
    "reason": "matched",
    "anchor": {
      "id": "匹配点UUID",
      "name": "老街入口",
      "distance_meters": 12.3,
      "cosine_similarity": 0.91
    },
    "assets": [{
      "id": "素材UUID",
      "file_type": "image",
      "file_url": "素材URL",
      "anchor_id": "匹配点UUID",
      "metadata": {},
      "config": {}
    }],
    "gps_radius_meters": 75,
    "embedding_version": "服务端模型版本标识"
  }
}
```

`assets` 保留管理端素材字段结构，包含 name/text_content/tag_ids/is_huge/config/metadata 等；仅包含命中匹配点在当前工作空间的直接子素材，不包含匹配点自身。小程序继续根据支持的素材类型与容量限制选择展示。素材地理位置仍由自身 metadata 描述；本接口不计算相对 anchor 的空间姿态。

未命中返回 HTTP 200：`{ "data": { "matched": false, "reason": "...", "anchor": null, "assets": [], "gps_radius_meters": 75 } }`。

| reason | 小程序建议 |
|---|---|
| `no_nearby_anchor` | 当前没有附近匹配点，降低采样频率 |
| `reference_not_ready` | 等管理端完成参考特征，不触发 AR |
| `model_version_mismatch` | 管理端更新特征，不触发 AR |
| `below_threshold` | 换角度继续采样 |
| `ambiguous` | 场景混淆，换角度确认 |
| `reference_changed` | 推理期间图库/位置发生变更，下次重试 |

错误：400 参数/坐标/图片格式错误，413 文件过大，422 候选过多，429 限流或模型繁忙，502/503 模型/数据库/配置不可用。返回 `{ "error": "说明" }`，不返回挂载素材。

单次响应是单帧判定，小程序建议连续 2–3 次命中同一匹配点后触发 AR，并实现触发去重和离开后重置。当前未实现服务端跨请求时序确认。

### 管理端特征接口

- `GET /api/assets/<anchor_id>/matching`：公开访问，返回状态，不返回向量。
- `POST /api/assets/<anchor_id>/matching`：公开访问，生成/重建该匹配点已保存参考图的特征。

图片新增/替换仍走原创建与 PATCH API。新建匹配点必须包含 name/file_url/metadata.latitude/metadata.longitude；存储 URL 仅接受本项目公开 assets 桶，禁止任意远程 URL。底层迁移会在图片替换时使旧特征失效，并阻止匹配点嵌套、自引用与跨工作空间挂载。

## 小程序调用示例

```js
wx.uploadFile({
  url: `${API_BASE}/api/miniapp/anchors/recognize?workspace_id=${workspaceId}`,
  filePath: cameraImagePath,
  name: 'image',
  formData: {
    latitude: String(gps.latitude),
    longitude: String(gps.longitude),
    accuracy: String(gps.accuracy),
    gps_timestamp: String(gps.sampledAt),
    coordinate_system: 'wgs84'
  },
  success(res) {
    const body = JSON.parse(res.data);
    if (res.statusCode === 200 && body.data.matched) {
      // 连续帧确认、去重后交给现有素材展示逻辑。
      handleMatchedAnchor(body.data.anchor, body.data.assets);
    }
  }
});
```

微信后台需将 API_BASE 配置为 uploadFile 合法域名。**旧的 `get_nearby_assets` 没有改动**；小程序接入新接口时，旧 GPS 拉取结果必须排除 `anchor_id` 非空的素材，防止挂载素材在视觉匹配前已经显示。小程序已实现独立的 GPS / 匹配点模式，本次识别调用已同步移除鉴权头。

## 验证与限制

`node --test scripts/test-anchor-matching.cjs` 用确定性的数据库/模型替身验证公开识别、状态与生成接口、代理放行边界及匹配流程，不验证真实模型精度或线上 PostGIS。

本次本地验证已通过类型检查、Next.js 生产构建、Storybook 构建及上述 16 项替身测试；最终 lint 通过（0 错误、21 条警告）。UI 沿用现有 `/manage` 设计体系，未新增全局设计 token。隔离组件截图复核覆盖中文桌面（1280 × 900）、英文移动端（390 × 844）的参考图就绪状态，以及移动端添加参考图状态；已确认长素材名换行、取消挂载控件可见、参考图与特征更新操作正常呈现。

2026-09-09 线上复查：此前 503 的实际响应是“匹配接口未就绪，请检查数据库迁移”，请求在工作空间限流 RPC 处失败，尚未调用模型。补齐两张表、三个业务 RPC 后，公开 multipart 识别请求返回 HTTP 200 / `no_nearby_anchor`；非法参数仍返回 400，不存在的匹配点返回 404，无登录重定向。这验证了生产路由与数据库链路，合成图片和测试坐标不验证识别精度。

当前工作空间的真实匹配点状态返回 `unconfigured`；线上还需配置 `SAGE_EAS_ENDPOINT`、`SAGE_EAS_TOKEN` 后重新部署，再生成参考特征。仅填写 `SAGE_MATCH_THRESHOLD` 不会建立模型连接。参考特征未就绪时，附近识别返回 `reference_not_ready`，不会调用模型或返回素材。

小程序现在优先展示后端 `{ error }` 的具体原因，非 JSON 错误保留通用提示，避免所有 503 都显示“匹配服务尚未就绪”。

启用前需：确认目标环境迁移已应用、配置可用 EAS 和数据库凭据、用现场正负照片校准阈值、生成参考特征、小程序切换调用并验证连续帧触发。图库更新不需要训练模型；增加正负样本用于阈值验证更直接。
