# 小程序接口 `/api/miniapp/*`

小程序通过匿名 HTTP 接口读取当前团队、地图合集、Asset 和 Scene 内容。所有响应 `Cache-Control: no-store`。管理端权限不授予匿名编辑权。参数错误 400，找不到或不可公开的内容 404，数据库异常 503。

| 接口 | 请求与返回 |
| --- | --- |
| GET `/organizations?ids=a,b` | 最多 50 个团队，返回 id/name 和小程序配置 |
| GET `/workspaces?ids=a,b` | 最多 50 个地图合集，返回 id/name；workspace UUID 就是 collection ID |
| POST `/assets/nearby` | `{user_lat,user_lng,max_distance_meters,p_workspace_id?,p_organization_id?}`；GPS 范围内启用投放 |
| POST `/assets/huge` | `{p_organization_id,p_workspace_id?}`；启用的巨大模型投放 |
| POST `/assets/scene` | `{asset_id,p_workspace_id?,p_organization_id?}`；asset_id 是 Placement ID，至少一个范围；返回其当前场景的 schema 2 清单 |
| POST `/scenes/preview` | `{scene_id,organization_id}`；独立场景当前保存内容，schema 2，未归档团队/场景才可访问 |
| POST `/shops` | `{p_workspace_id,p_organization_id}`；Shop 投放，允许没有 GPS 的目录项 |
| POST `/text-assets` | `{content,p_workspace_id,p_organization_id?,user_lat?,user_lng?}`；创建团队文字 Asset 和合集投放，有 GPS 为 active，否则 draft |
| POST `/anchors/recognize?workspace_id=…` | multipart image、latitude、longitude、accuracy、gps_timestamp、coordinate_system=wgs84；匹配当前参考图并返回关联投放 |

地图公开内容统一来自未归档团队、未归档合集中的 active Placement。两个范围同时提供时必须匹配。暂停或归档投放即从发现和地图场景接口消失。每个发现记录的 id 是独立 Placement ID，同一 Asset 或 Scene 在多个合集投放不会混淆。Source Asset ID 与 Scene ID 不充当地图实例 ID。

Asset 文件取当前 `asset_resource`，Scene 取当前 `scene.document` 并解析当前 Asset 文件。位置、高度、标签和展示覆盖来自 Placement。素材和场景保存后，客户端下次请求即可读到更新。不存在 legacy 查询分支、版本表、绑定映射或发布步骤。

播放字段 `file_type/file_url/text_content/metadata/config` 是公开渲染协议；`assets/scene` 的 asset_id 字段保持已印制地图入口的客户端契约。场景二维码使用 sceneId+organizationId，由独立预览页调用 `/scenes/preview`，不依赖合集或 GPS。未保存编辑不进入预览，归档场景禁止直接预览，既有地图投放继续使用其保存内容。

匿名文字最多 500 字，每 IP 每分钟 20 次、每合集每分钟 120 次；提交事务重新检查团队与合集归档状态。匹配接口每设备每分钟 90 次（无合法 X-Client-Id 时按 IP），每合集每分钟 3000 次。识别请求可传 X-Recognition-Request-Id，响应回显请求 ID 与诊断耗时。

音频 `.webm` 的 `.m4a` 衍生文件仍由转码与保留流程管理。微信合法域名需包含后端 request/uploadFile 域名和媒体 downloadFile 域名。
