# 单一内容模型迁移

本分支只运行团队素材、场景和地图合集模型。`npm run db:migrate` 按迁移账本逐项执行，每项在独立事务内转换数据并移除旧结构，不再按组织选择模型，不需要请求头、激活接口或灰度开关。

## 数据转换

- 原 `workspace` 保留 UUID、名称、团队、标签和二维码上下文，成为地图合集。团队拥有素材和场景，合集只拥有投放。
- 第一项迁移将旧素材和场景转换为团队内容，跨团队来源拆成独立素材，同团队跨合集使用独立投放。GPS、高度、标签和展示参数跟随投放迁移。
- `20261017220000_mutable_assets.sql` 随后将每个素材的 `current_version_id` 对应内容和文件合并到 `asset.payload` 与 `asset_resource`。地图投放、草稿及已发布场景统一通过 asset ID 使用当前内容，即使原来固定的是更早版本。
- 草稿和发布布局转为 schema 4，删除 `assetVersionId`；布局本身、发布 ID、投放 ID 不变。不再保留运行时版本表、版本指针或切换逻辑。
- 匹配特征只保留当前参考图的数据，未完成任务标记为失败，特征主键改为 asset ID。后续替换参考图会清除旧特征。
- 迁移前完整内容保存在 `migration_archive.mutable_asset_source`；不再被当前素材使用的历史托管文件加入 `storage_hold`。这些归档只用于恢复，运行时不读取；迁移不删除物理文件。
- 缺少有效当前版本的素材会使本项迁移整体失败。原始无归属、无效场景等问题仍必须在第一项迁移前修复或明确隔离。
- workspace 成员授权、素材使用授权、旧公开 ID 映射、共享 scope、旧写入函数和模型状态均已移除。

## 执行

1. 对目标数据库做完整备份，并先在副本运行迁移。停止旧应用写入；本次升级包含删列和删表，旧应用不能继续连接升级后的库。
2. 使用目标数据库的 `DATABASE_URL` 和实际 `NEXT_PUBLIC_MEDIA_BASE_URL` 执行 `npm run db:migrate`。迁移不会上传或删除 OSS 文件。升级入口只有 `db:migrate`，分阶段切换和回切脚本已移除。
3. 检查迁移账本、合集数量、各合集投放、素材直接引用、资源清单及隔离归档，再部署本分支应用。
4. 验证团队素材创建、场景发布、合集投放、小程序发现、二维码和匹配点。新库直接使用 `db/schema.sql` 的最终结构。

迁移器持有数据库级迁移锁，并为每项迁移在同一事务内执行数据转换和 DDL。失败会回滚当前迁移；已完成的迁移由 `schema_migrations` 跳过。成功之后需要回退时，应停写并恢复升级前备份及对应应用版本，不能重新启用旧模型写入。

## 验证脚本

`test-single-content-model-migration.ts` 使用 `scripts/test-support/pre-single-content-model.sql` 作为升级前快照，要求 127.0.0.1:55439 上全新的 `content_single_migration` 专用数据库。它验证失败回滚、跨团队拆分、合集独立投放、场景版本固定、标签、高度、资源、隔离保留和旧结构移除。

`test-content-model-services.ts`、`test-team-workbench-routes.ts` 在同一验证容器的 `team_wb_services` 数据库验证最终服务和无版本请求头的 HTTP 契约。测试不连接生产存储。


`test-mutable-assets-migration.ts` 使用迁移前快照，在全新的 `content_mutable_migration`（127.0.0.1:55439）验证当前内容选择、旧版本引用转换、合集与投放 ID 保留、历史文件保护、识别特征迁移、失败回滚和账本重入。最终服务测试使用同端口的 `content_mutable`。
