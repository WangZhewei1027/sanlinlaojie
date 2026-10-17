# 素材版本与文件保留生命周期

本文描述 `lib/storage/retention.server.ts`、`lib/upload/receipts.server.ts` 和素材版本服务的保留协议。组织迁移状态与单写源见 [数据层](data-layer.md)，上传入口见 [Asset Pipeline](asset-pipeline.md)。代码落地不表示生产组织已迁移或已开启物理删除。

## 素材身份、版本与文件

Asset 是组织拥有的素材身份；AssetVersion 是不可变内容；`asset_version_resource` 是该版本实际保留的文件清单。主文件、封面、Shop 打卡图、兼容音频等分别登记 role。多个版本或素材可引用相同物理 key，不能因为 hash 相同就合并业务身份。

- 新上传媒体使用受管 key，文件内容不原地覆盖。替换文件创建新版本，旧场景和投放继续引用原版本。
- `current_version_id` 是目录默认版本，不决定历史引用是否保留。
- 本站 OSS URL 必须识别为受管文件，不能作为外站地址绕过保留；新提交通过 receipt 或有权限的来源版本引用文件。
- 外站文件只固定 URL，无法保证远端字节不变，不进入 OSS 删除流程。
- 归档 Asset、Scene 或 Placement 不删除版本和文件。当前没有自动版本过期或任意删除历史版本的用户入口。

## 上传回执与组织内去重

文件上传按处理后的最终字节计算 SHA-256。去重以组织为范围；来源包括同组织版本资源、legacy 素材与有效的上传回执。字节复用仍需验证对象存在并遵守对象锁协议。

`upload_receipt` 绑定 user、organization、workspace、storage_key、hash、大小、用途和过期时间。`asset_version` 提交校验回执的操作者、组织、有效期与 `asset_version` 用途。回执有效期为 24 小时；`consumed_at` 记录提交，不代表可以立即删除该文件。

回执同时保护上传成功但业务事务尚未提交的文件。上传失败、用户取消、命令重试由幂等与租约处理；不要因为某次客户端创建失败，就直接删除可能被另一请求引用的对象。

物理路径仍可能是首个上传者的 `assets/{userId}/…`。路径不能推导素材所有权，删除用户也不能按目录删除团队文件。

## 全局保留集合

`isKeyProtected` 检查单个 key，`collectProtectedKeys` 为清扫提供全局候选过滤。保留来源包括：

| 来源 | 必须保留的内容 |
| --- | --- |
| `asset_version_resource` | 所有保留版本的 storage_key，不只 current 或当前上线版本 |
| `upload_receipt` | 未过期的上传租约 |
| Legacy Asset | file_url、metadata.checkin_url，以及 metadata/config/text 中仍保存的受管文件引用 |
| Anchor | anchor_embedding.image_url |
| 音频兼容文件 | 同名 `.webm` / `.m4a` 互相保护；回填时登记实际派生资源 |

去重虽然已收口到组织内，历史跨组织素材可能仍共享同一个物理文件，所以保留集合必须始终覆盖所有组织。发布依赖通过外键保留 AssetVersion；文件保留由其 resource 清单继续承担。

## 回收协议与默认开关

实际删除默认关闭。只有 `app_config` 中 `managed_object_deletion` 的值明确为 `{ "enabled": true }` 时，回收器才删除无引用对象；其他情况报告 `candidates`。不能把启用删除视为数据库迁移的自动步骤。

复用、版本提交和回收遵守同一协议：

1. 在数据库事务中取得 `object-key:<storageKey>` advisory lock。
2. 复用/提交方在锁内建立 receipt 或 resource；回收方在锁内重新检查全部保留来源和上传租约。
3. 回收方保持锁直到 OSS 删除结束，复用方在提交前确认对象仍可用。
4. 失败记录日志并返回 `failed`，不会把存储错误当作对象不存在。

单独延迟、仅在删除前 count 一次、只检查当前 Asset 或只检查当前组织都不满足这个协议。批量清扫先做快照过滤，但每个候选仍经过锁内复核。

所有文件释放入口都必须调用统一保留层：单素材文件替换/删除的 legacy 包装、上传补偿删除、管理员清扫、用户/组织清除，以及转码派生文件操作。禁止在这些调用点绕过保留层直接 `deleteObjects`。

## 数据删除与迁移

逻辑修改/删除先完成并提交，之后才尝试释放不再保留的文件。这样存储失败最多留下孤儿文件，不能先删除文件再尝试修改数据库。

V2 的草稿、发布依赖及 Placement 对版本使用引用约束。撤项目 grant 时有历史发布依赖仍会被阻止；归档不释放依赖。组织/用户硬删除需要完整 deletion plan，包含跨项目投放、旧公开 ID 绑定、版本和旧兼容行，不能继续仅按 legacy workspace 数组包含关系清除。

Legacy 模式仍保留当前 Asset 字段和旧文件去重关系。这些旧字段是迁移保护来源，不能在回填后、公开路由切换前提前清空。跨组织拆分素材身份可以复用物理文件，不能顺便收窄回收范围。

Legacy/preparing 期间显式删除已被回填版本或投放引用的旧行时，兼容服务移除其旧项目与标签成员关系，让它退出旧展示面；暂存身份、版本及文件继续保留。迁移工具须识别该源数据变化并重新处理，删除请求不猜测级联关系，也不立即回收文件。

迁移窗口只报告回收候选。死链检查遇到 HEAD 请求失败时报告错误；确认缺文件也不能自动删除仍被场景或投放引用的身份/版本，应列出修复项。恢复回收前必须核对全部写入者都使用同一协议；发布和部署状态以实际验证记录为准。

## 代码入口

| 模块 | 职责 |
| --- | --- |
| `lib/storage/retention.server.ts` | 全局保留、对象锁、删除开关、候选报告 |
| `lib/upload/receipts.server.ts` | 回执、组织内去重、提交身份校验 |
| `lib/assets/versions.server.ts` | 解析文件来源，追加不可变版本与 resource |
| `lib/storage-cleanup.server.ts` | 旧调用方的文件清理入口，需服从统一保留协议 |
| `app/api/admin/clean/route.ts` | 管理员检查和清扫入口 |
| `lib/user-deletion.server.ts` | 用户/组织删除预览与执行 |
| `scripts/transcode-webm-to-m4a.ts` | 音频兼容文件处理 |
