# 小程序直连 Supabase 图像识别

识别主链路为：小程序上传 JPEG + WGS84 GPS → Supabase Edge Function `recognize-anchor` → 数据库候选/参考向量 → 阿里云 SAGE → 数据库复检/关联素材 → 小程序。

参考图生成与管理仍沿用管理端；旧 Vercel `/api/miniapp/anchors/recognize` 路由保留兼容。新的识别请求不经过 Vercel。Edge Function 不存储上传的现场图，不加载或重新生成参考图，不缓存候选集合，不自动重试模型请求。

## 请求与公开访问

`POST https://mkdfezaufjhrfjkfqlbj.supabase.co/functions/v1/recognize-anchor?workspace_id=<uuid>`

使用 `multipart/form-data`：`image`（JPEG/PNG/WebP，不超过 4 MiB）、`latitude`、`longitude`、`accuracy`（0–100 米）、`gps_timestamp`（Unix 毫秒，最近 30 秒）、`coordinate_system=wgs84`。总请求体上限额外预留 64 KiB 表单开销。

可传 `X-Recognition-Request-Id`，只接受 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`。缺失则服务端生成 UUID；格式错误返回 400，同时返回新的安全 ID。该 ID 贯穿 JSON、响应头以及发往 EAS 的同名请求头。模型实际回传的 ID 单独记录为 `upstream_request_id`。

`supabase/config.toml` 仅对该函数设置 `verify_jwt=false`。小程序不需要用户登录或模型凭证。CORS 支持 POST/OPTIONS，允许 Content-Type、X-Recognition-Request-Id、x-region；实际运行区域来自服务端 `SB_REGION`，返回为 `edge_region`。数据库新 RPC 仍只对 `service_role` 开放。

## 两次数据库往返

1. `prepare_anchor_match_context`：调用现有工作空间共享限流（每分钟 120 次），按 GPS 筛选候选，并读取这些候选的参考向量。半径为 `min(200, max(75, accuracy×2))` 米。最多取 201 个，超过 200 个直接拒绝。附近任一竞争者的特征非 ready 或图片 URL 已变化，本轮返回 `reference_not_ready`，不调用模型。
2. 视觉分数过线后才调用 `finalize_anchor_match`：在同一 SQL 快照中重新读取候选及参考版本，并返回匹配点在当前工作空间关联的非 anchor 素材。候选新增、删除、移动、换图或参考特征重新生成均使快照不同，返回 `reference_changed`，不返回素材。

快照包含候选 ID、图片 URL、精确位置、参考 generation/status/version/updated_at/SHA256，只在 Edge 与数据库之间传输。它不出现在公共响应。这样避免长期缓存造成的增量数据失效问题，也避免复检和素材读取之间的独立网络往返。

视觉判定与原实现相同：8448 维向量归一化后算余弦相似度，第一名至少达到 `SAGE_MATCH_THRESHOLD`；有第二名时分差至少达到 `SAGE_MATCH_MARGIN`（缺省 0.03）。阈值必须显式配置，没有自动降低或默认阈值。模型版本不同则拒绝匹配。

## 耗时与错误

每轮从 Edge handler 开始使用 **15 秒共享时间预算**，包含上传流读取和 multipart 解析。单次数据库调用最多 6 秒、模型调用最多 12 秒，且 fetch 与响应体读取共用同一个阶段计时；后续阶段只能使用本轮剩余时间，不会重新获得完整超时额度。预算到期会主动中止出站请求/取消读取，保留已完成阶段与失败阶段耗时；上传阶段超时返回 408 / request_timeout，模型超时仍为 504 / model_timeout，数据库超时仍为 503 / database_unavailable。deadline 只在服务端请求上下文内部传递，不从 HTTP 接受、不写入 diagnostics。上述时限不包含到达函数前的网络/平台排队以及响应传输。

成功响应兼容 `{data:{matched,reason,anchor,assets,...}}`，增加 `data.request_id`；诊断位于 `data.diagnostics`。错误响应为 `{error,code?,request_id,retry_after_ms?,diagnostics}`，已完成阶段同样可见。

`diagnostics.timings_ms`：

| 字段 | 含义 |
|---|---|
| request_parse_ms | 请求体读取、表单解析与图片校验 |
| validation_ms | GPS、匹配阈值及范围校验 |
| database_context_ms | 限流 + GPS 候选 + 参考向量合并 RPC 的真实往返 |
| model_request_ms | Edge 到 EAS 的完整请求，包括网络、排队、模型处理及响应解析 |
| model_queue_ms | 模型返回的 queue_wait_ms |
| model_decode_ms | 模型返回的 decode_ms |
| model_inference_ms | 模型返回的 inference_ms |
| model_service_total_ms | 模型返回的 service_total_ms |
| ranking_ms | 特征归一化、排名和分数判定 |
| database_finalize_ms | 候选/参考复检 + 关联素材读取合并 RPC |
| matching_total_ms | 匹配函数总时间，含上述数据库和模型请求 |
| api_total_ms | 整个 Edge handler 到构建响应前的时间 |

模型内部阶段包含在 `model_request_ms` 中，不能再次相加。`matching_total_ms` 和 `api_total_ms` 同样是包含关系。未执行或旧模型未提供的字段省略，不填造假的零，也不把合并 RPC 拆分成旧的三个计时。

`model_device` 只接受 cpu/cuda/cuda:N，帮助核对实际执行设备。模型版本不包含在公开诊断中，但成功匹配仍返回原协议的 `embedding_version`。

| 错误 | HTTP / code | 重试提示 |
|---|---|---|
| 工作空间限流 | 429 / workspace_rate_limited | 60 秒 |
| 模型队列已满 / 等待超时 | 429 / model_queue_full 或 model_queue_timeout | 1 秒 |
| 其他 EAS 429 | 429 / model_busy | 1 秒 |
| EAS 请求或读取超时 | 504 / model_timeout | 2 秒 |
| 无法连接 EAS | 502 / model_network_error | 2 秒 |
| EAS 非 2xx、非 429 | 502 / model_unavailable | 2 秒；upstream_status 保留真实状态 |
| EAS 响应协议无效 | 502 / model_invalid_response | 无自动重试 |

模型错误体最多读取 16 KiB，且只放行固定 code、有限非负计时、设备及严格校验的请求 ID。不返回原始错误体、凭证、URL或向量。若请求被 Supabase/运营商等前置平台拒绝而未到 handler，将没有这些业务诊断；不能把无诊断的 403 直接认定为模型错误。

## 配置、部署与回退

Edge Function 自动读取 Supabase 运行时的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。额外 secrets 为 `SAGE_EAS_ENDPOINT`、`SAGE_EAS_TOKEN`、`SAGE_MATCH_THRESHOLD`、`SAGE_MATCH_MARGIN`。使用现有私密配置文件导入，不能把这些值写入代码、日志或小程序。

先应用 `supabase/migrations/20260915010000_anchor_match_context.sql`，再部署 `recognize-anchor`，最后切换小程序地址。迁移依赖已存在的匹配表/附近查询函数和 120 次限流函数，不删除旧数据、不修改已有函数。常规项目可先 `supabase db push --linked --dry-run --skip-vault` 核查待执行列表。

本项目已知存在远端旧历史、本地缺失的情况，不能通过 repair/drop 旧历史绕过。部署者应精准应用本次迁移并在同一事务登记本版本，回读函数定义及 service_role-only 权限后再部署 Edge。不要批量推送或重跑无关旧迁移。

回退可让小程序重新调用旧 Vercel 地址；新增私有 RPC 不影响旧链路。新增函数不改变参考向量格式、阈值或模型版本。

## 本轮部署和线上验收

数据库迁移、公开 Edge Function 和四项 SAGE secrets 已完成配置与部署。小程序固定请求头 `x-region: ap-south-1`（孟买），该区域与现有 Supabase 数据库相同；以响应中的 `edge_region` 核对实际路由。

EAS 出站保持显式 HTTP/1.1、禁用空闲连接复用；仅精确的 EAS `/embed` 地址使用专用 HttpClient，数据库请求继续使用默认 fetch。上传模型前把同一份 multipart 序列化为 ArrayBuffer，并使用对应的 boundary 和字节长度；图片字节不经过再次解码或压缩，序列化也计入模型请求的 12 秒阶段预算。

这些配置是当前通过验收的组合，**不能据此认定 HTTP/2、连接复用或 chunked 是先前超时的根因**。仅关闭连接复用时仍出现过超时；Deno 原生 FormData 本身也会记录完整长度，缓冲上传主要改变发送实现路径。[Deno FormData 实现](https://github.com/denoland/deno/blob/v2.1.4/ext/fetch/22_body.js#L440)

区域对照中，孟买先有 6/6 次返回 200，随后完成 12/12 次最终验收；同样的缓冲上传方案在东京仍有 1/8 次超时，在新加坡有 2/6 次超时。因此本轮选择固定孟买，以后仍应依据实际请求诊断观察链路稳定性。

使用同一参考画面、最长边 640 的查询图，按约 1 秒发起一次接口调用：

| 链路 | 样本结果 | 往返最小值 | 往返中位数 | 往返最大值 |
|---|---|---|---|---|
| Supabase Edge / 孟买，最终验收 | 12/12 HTTP 200 且匹配成功 | 2.447 秒 | 2.868 秒 | 3.800 秒 |
| 旧 Vercel 识别接口，对照 | 4/4 HTTP 200 且匹配成功 | 5.841 秒 | 7.004 秒 | 7.786 秒 |

最终 Edge 12 次均返回 1 个关联 asset，查询相似度均为 0.9629283325，模型设备均为 cuda，客户端与模型 request_id 相同；另一次原始参考图自身校验的相似度约为 1。Edge 中位数分段：数据库候选/参考 100 毫秒、Edge→EAS 请求 1903 毫秒、模型推理 128.49 毫秒、命中复检/素材读取 38 毫秒；模型排队中位数为 0 毫秒。可见模型推理本身只占完整请求的一部分。

上述是本轮小样本在线接口结果，不是长期可用性或端到端真机延迟保证；往返包含测试端上传和接收，不含手机相机取图及素材渲染时间。

原始结果保存在相邻 ai-location 项目：

- [孟买最终 12 次验收](../../ai-location/deploy/sage/generated/gpu/edge-mumbai-final-cadence.json)
- [旧接口每秒调用对照](../../ai-location/deploy/sage/generated/gpu/legacy-one-second-cadence.json)

## 本地验证

```sh
node --test scripts/test-edge-entry.cjs scripts/test-edge-recognition.cjs scripts/test-anchor-matching.cjs
deno check supabase/functions/recognize-anchor/index.ts
```

Node 测试加载真实 Edge 模块，用确定性数据库/模型替身验证请求协议、GPS 优先、全部竞争者 ready、分数规则、复检、两次 RPC、无自动重试、错误隐私和 CORS。数据库迁移另需在部署时验证真实 PostgreSQL/PostGIS；这些替身测试不验证远端 SQL、网络速度或模型精度。

本轮共 42 项回归通过；新增上传保真检查从实际模型 fetch 参数反解 multipart，逐字节比较图片并核对 boundary、Content-Length、请求 ID 和 AbortSignal。入口 VM 测试执行真实 index.ts，验证专用客户端只路由到精确 EAS 地址，不替代真实 Deno 网络验证。
