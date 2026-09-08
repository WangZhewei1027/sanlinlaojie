# 匹配点与小程序混合识别

`asset.file_type = 'anchor'` 保持兼容，管理端展示为「匹配点」。每个匹配点先存一张参考图片，使用现有 `asset.file_url`、`content_hash`；子素材通过现有 `anchor_id` 关联。匹配只代表识别到附近地点，不提供相机 6DoF 或厘米级 AR 重定位。

## 管理端

1. 在具体工作空间中新建「匹配点」，填写名称、地图位置和一张 JPEG/PNG/WebP 图片。参考图按 1 MiB 目标压缩，上限 4 MiB。
2. 保存后服务端尝试生成特征。图片保存与特征生成分离：模型暂不可用时保留图片，在编辑器中显示未配置、待生成或失败状态；可点击「生成 / 更新匹配特征」重试。
3. 匹配点详情列出挂载素材，可选择当前工作空间中尚未挂载的素材，或取消挂载。也可在素材编辑器的「关联匹配点」中指定。
4. 按本次要求清空旧 anchor：迁移先解除子素材关联，再删除所有旧 anchor；其他素材保留。随后重新创建匹配点。复制出来的匹配点需要生成特征；更换模型版本后逐个更新受影响的参考特征。

更新参考图只处理该点的新图。修改名称、位置或挂载关系不需要重新编码。镜像中不放图库，识别过程中不下载参考图。

## 数据库与环境变量

部署前审核并执行 `supabase/migrations/20260908000000_anchor_matching.sql`。此迁移按用户要求删除执行时存在的所有 anchor，先解除挂载关系、保留其他类型素材；必须在新管理端启用、新匹配点录入之前执行。整个迁移在一个事务中执行，失败回滚。存储文件不作批量删除，以免误删其他素材共用的文件。随后新增私有特征表、工作空间请求限流表和服务端 RPC；asset 字段、类型值、旧 RPC 均保持兼容。迁移不会自动填充图库特征。

此版本的表结构依据仓库已有查询与迁移：`asset.id`/`workspace.id` 为 UUID，`workspace_id` 是 UUID 数组，`location` 是存储 WGS84 经纬度的 PostGIS 几何点，现有写入使用 SRID 0。查询先显式设为 4326 再转换 geography 计算米。当前线上 schema 只读检查返回 401，迁移尚未线上执行或验证；部署前需在有效凭据的测试环境确认这些前提。

服务端配置（不要将 service role 或 EAS Token 写入小程序）：

```dotenv
SAGE_EAS_ENDPOINT=https://你的EAS网关/api/predict/你的服务名
SAGE_EAS_TOKEN=控制台提供的Token
# 必填：用实际正负样本校准，不提供通用到达阈值默认值。
SAGE_MATCH_THRESHOLD=填写校准后的余弦相似度阈值
# 工程初值，前两名分差不足则判为不确定；需要实测调整。
SAGE_MATCH_MARGIN=0.03
# 可选：允许使用现有小程序公开 apikey 调用的 workspace UUID，逗号分隔。
# 设置它会向持有公开 apikey 的调用方开放这些工作空间的匹配与挂载素材读取。
ANCHOR_PUBLIC_WORKSPACE_IDS=
```

同时需要项目现有的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和有效 `SUPABASE_SERVICE_ROLE_KEY`。EAS 需使用 ai-location 项目当前的 `POST /embed` 服务，返回 `sage_vitb` 的 8448 维向量及 `embedding_version`。EAS Token 以原值置入 Authorization，不加 Bearer。

新增表只允许 service_role 访问。管理端先验证资产权限，再读取/生成特征。小程序接口先校验访问工作空间的权限，之后才使用 service_role 查候选点和子素材；不将特征向量返回小程序。

## 新 API

### `POST /api/miniapp/anchors/recognize?workspace_id=<uuid>`

小程序通过 `wx.uploadFile` 发 multipart/form-data，无需管理端 Cookie。必须传具体工作空间，不能传全部组织范围。

鉴权二选一：

- `Authorization: Bearer <Supabase 用户 access_token>`：验证用户及工作空间可见性，owner/admin/super_admin 或有工作空间分配的成员可调用。
- `apikey: <项目公开 key>`：仅当工作空间在服务器 `ANCHOR_PUBLIC_WORKSPACE_IDS` 中时开放。这与现有小程序的匿名访问形式衔接，公开 key 不是用户身份验证。

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

错误：400 参数/坐标/图片格式错误，401/403 未授权，413 文件过大，422 候选过多，429 限流或模型繁忙，502/503 模型/数据库/配置不可用。返回 `{ "error": "说明" }`，不返回挂载素材。

单次响应是单帧判定，小程序建议连续 2–3 次命中同一匹配点后触发 AR，并实现触发去重和离开后重置。当前未实现服务端跨请求时序确认。

### 管理端特征接口

- `GET /api/assets/<anchor_id>/matching`：Cookie 登录，返回状态，不返回向量。
- `POST /api/assets/<anchor_id>/matching`：Cookie 登录且拥有该资产所有所属组织的写权限，生成/重建该参考图特征。

图片新增/替换仍走原创建与 PATCH API。新建匹配点必须包含 name/file_url/metadata.latitude/metadata.longitude；存储 URL 仅接受本项目公开 assets 桶，禁止任意远程 URL。底层迁移会在图片替换时使旧特征失效，并阻止匹配点嵌套、自引用与跨工作空间挂载。

## 小程序调用示例

```js
wx.uploadFile({
  url: `${API_BASE}/api/miniapp/anchors/recognize?workspace_id=${workspaceId}`,
  filePath: cameraImagePath,
  name: 'image',
  header: { apikey: SUPABASE_PUBLIC_KEY },
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

微信后台需将 API_BASE 配置为 uploadFile 合法域名。**旧的 `get_nearby_assets` 没有改动**；小程序接入新接口时，旧 GPS 拉取结果必须排除 `anchor_id` 非空的素材，防止挂载素材在视觉匹配前已经显示。当前交付只修改 web 项目，没有改小程序代码。

## 验证与限制

`node --test scripts/test-anchor-matching.cjs` 用确定性的数据库/模型替身验证匹配流程与访问边界，不验证真实模型精度或线上 PostGIS。

本次本地验证已通过类型检查、Next.js 生产构建、Storybook 构建及上述 16 项替身测试；最终 lint 通过（0 错误、21 条警告）。UI 沿用现有 `/manage` 设计体系，未新增全局设计 token。隔离组件截图复核覆盖中文桌面（1280 × 900）、英文移动端（390 × 844）的参考图就绪状态，以及移动端添加参考图状态；已确认长素材名换行、取消挂载控件可见、参考图与特征更新操作正常呈现。

这些检查只覆盖本地构建、替身逻辑和所列 UI 状态，不构成端到端验证。尚未联通真实数据库或 EAS 验证上传、特征生成、挂载/取消挂载与识别全流程；线上 schema 检查返回 401，清空旧 anchor 的事务迁移也尚未远程执行。

启用前需：执行并验证迁移、配置可用 EAS 和数据库凭据、用现场正负照片校准阈值、生成参考特征、小程序切换调用并验证连续帧触发。图库更新不需要训练模型；增加正负样本用于阈值验证更直接。
