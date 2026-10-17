# 团队内容模型迁移操作手册

本手册对应 `team-assets-scenes-refactor-plan.md` 的 M0–M5。脚本已实现预检、审核输入、文件清单、可回滚影子回填、核验、只读切换及受限路由回退。它们不会加载 `.env.local`，不会上传、删除或主动下载 OSS 文件，也不会运行部署。首次执行应在备份恢复的隔离库演练。

迁移单元是组织及历史跨组织共享记录连接起来的完整组织集合。旧组织/项目 UUID、二维码参数和旧公开 ID 保持稳定。准备阶段旧表仍为写源；新版本、场景和投放只是影子数据。切换后新服务为唯一写源。

## 1 前置条件

部署顺序是：备份并演练 → 执行扩展 DDL（`db:migrate`）→ 部署兼容新旧模型的应用 → 审核与影子回填 → 按完整组织依赖组冻结并切换。新应用依赖新增表列，不能先指向尚未执行 DDL 的旧库；DDL 本身不会自动把现有组织切到 v2。

1. 应用已经部署新版权限、上传回执、版本资源保留、旧写入拦截及 miniapp 兼容适配；实际文件删除在迁移窗口关闭。迁移脚本不代替这些应用能力。
2. 已备份数据库和文件清单，保存旧 nearby、huge、scene、shops、recognize 接口样本，并确认新旧二维码范围一致。
3. `db:migrate` 已成功执行，增量和 fresh schema 已核对一致。旧实验表冲突必须先导出核对，不能删除后蒙混过关。
4. 操作者明确提供 `DATABASE_URL`、环境、run ID、组织集合。命令中的数据库连接来自当前 shell，不会被环境文件覆盖。`--environment local` 只接受回环地址，但这不是数据库身份校验；务必核对实际库名。
5. 在资产量大的生产组织，先测量锁时长。当前脚本以完整依赖组为一个事务，使用短时间表锁排空历史写入，`statement_timeout=60s`、`lock_timeout=10s`。超过窗口应调整执行方案或拆分互不关联的组织组；不能拆开同一个跨组织依赖组。尚未实现大组织分块流水线。

## 2 生成审核输入

所有命令均从仓库根运行，使用 `npx tsx --conditions react-server`。下方变量必须由操作者明确填写；示例不会自动连接生产环境。

```bash
RUN_ID='<new UUID>'
ORGANIZATIONS='<organization UUIDs, comma separated>'
ENVIRONMENT='local'
npx tsx --conditions react-server scripts/migrate/content-model/audit.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --output /absolute/path/audit.json
```

先检查 `required_organizations`。若它大于请求集合，必须将整个集合重新作为 `--organizations` 生成审核文件。跨组织旧行会形成传递依赖，例如甲↔乙、乙↔丙意味着三个组织一起切换。

复制 audit JSON 为 `review.json`，保留 `source_fingerprint`、每条 `source_hash`、`dependency_hash`、类型、依赖和范围事实，不修改这些机器生成字段。补充：

```json
{
  "reviewed": true,
  "review_notes": {
    "<source asset UUID>": "已确认来源项目；另一组织分配独立身份",
    "assignment:<workspace UUID>:<user UUID>": "异常角色保留只读并隔离，待管理员处理"
  },
  "media_base_urls": ["https://your-media-host.example"],
  "resource_inventory": [
    {
      "storage_key": "assets/user/model.glb",
      "exists": true,
      "checked_at": "2026-10-15T00:00:00.000Z",
      "content_hash": "verified hash when available",
      "mime_type": "model/gltf-binary",
      "size_bytes": 1234
    }
  ],
  "additional_resources": [
    {"source_id": "<audio asset UUID>", "role": "audio_compat", "url": "https://your-media-host.example/assets/user/sound.m4a"}
  ]
}
```

这些字段是加入完整 audit 文件的属性，不能只将此片段作为输入。`media_base_urls` 必须显式提供，包括确认全部资源是外链时的空数组；填写所有仍在旧数据中出现的受管媒体域名，不能借用省略域名把托管文件降为外链。迁移只固定外链地址，不能保证第三方 URL 的字节内容永远不变。

逐条决定 `mappings`：

- 无歧义项保留 `disposition: "migrate"`。
- 需要审查的条目明确选择 `source_workspace_id`，将 `disposition` 改为 `migrate`，并写 `review_notes[source_id]`。多项目普通素材可以没有来源项目；场景和投放必须有唯一来源项目。
- 跨组织普通素材/场景的各 target 需要唯一 UUID，必须明确其中一个组织保留旧 UUID，其余使用新 UUID。重复回填必须沿用同一拆分 ID。两个组织的物理文件可继续相同。
- 单组织记录保留旧 UUID。`workspace_ids` 和 `create_placement` 是旧行为事实，不能通过审核文件任意修改。需要改变行为应先修复源数据再审计。
- `maintained_by` 可为当前非 viewer 组织成员；无有效维护者时为 null，交组织管理员接管。不要按 OSS 路径猜维护者。
- 坏 JSON、缺模型、孤立归属、跨组织 Anchor 等设为 `isolate` 并写理由，保留源数据。源事实已判定无效时，单加说明不能强制迁移。
- 非 0/4326 的坐标参考系必须修复源坐标后重新 audit，或者隔离；写一个确认说明不等于坐标转换。
- 跨组织 Anchor 保留识别/embedding 语义，不能自动复制身份。先明确隔离/修复归属，再迁移。
- 原先已经 staged、随后被旧系统删除的记录，须在新审核文件的 `retire_source_ids` 明确列出并写 `review_notes[id]`；回填会暂停其旧影子投放。历史不可变版本继续保留。

已确认隔离的条目不会进入 v2 公开发现。必须在切换清单中明确接受这部分差异，或修复后重新审核；不能将“保留源数据”误认为“切换后仍公开展示”。

## 3 核对资源清单

```bash
npx tsx --conditions react-server scripts/migrate/content-model/inventory.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --input /absolute/path/review.json --output /absolute/path/resources-to-check.json
```

这一步只导出候选 key，不宣称文件存在。用已授权的只读存储 inventory/HEAD 核验，然后填写 `resource_inventory`。受管主文件、Shop 打卡图、缩略图、Anchor 参考图全部登记；历史同名 m4a 只有实查存在后才能加入 `additional_resources`。不能由 `.webm` 扩展名推断 `.m4a` 存在。

metadata/config/text 内出现尚未分类的受管 URL 时，脚本拒绝回填。需先明确字段语义并补迁移映射或隔离记录，不能把未知文件藏进自由 JSON 逃过保留统计。托管文件的两个音频 key（webm/m4a）锁与应用回收协议一致。

历史嵌套字段完整存入不可变 `payload.migration_legacy`。它仅由迁移器写入；正常创建/编辑 API 不接受这个历史兼容字段。运行时兼容 DTO 从该快照恢复历史 metadata/config，并使用版本资源解析文件，不能重新读取旧 Asset 的当前 URL。

## 4 影子回填与核验

默认 dry-run 会在一个事务中完整执行 SQL 和约束，再回滚。它可能短暂取得数据库锁，但不会留下迁移记录或内容。

```bash
npx tsx --conditions react-server scripts/migrate/content-model/backfill.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --input /absolute/path/review.json --output /absolute/path/backfill-dry-run.json
```

检查结果后，同一命令增加 `--apply`。成功后组织进入 `preparing`；若已冻结则保持 `readonly`。重复执行同一审核文件不增加版本、场景修订或投放。不可变内容按源/文件清单指纹追加，独立身份和 canonical 投放按映射复用。跨组织拆出的影子 Asset 保持空旧 workspace 数组和空旧 location，因此不会混入旧发现接口。

```bash
npx tsx --conditions react-server scripts/migrate/content-model/verify.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --input /absolute/path/review.json --output /absolute/path/verified.json
```

核验检查完整源及依赖指纹、审核文件摘要、身份/维护者/grant、资源清单、schema 3 固定引用和反向索引、初始 revision、投放固定目标、GPS/Anchor/配置/标签、公开 ID 和历史项目 scope。普通未投放 Scene 不生成初始发布；无 GPS 的 Shop 仍生成目录投放；Anchor 无展示投放。

此外仍须比较预先保存的真实接口样本。迁移核验不代替浏览器、小程序、鉴权与对象存储集成验证。

## 5 切换和差异追平

先运行不带 `--apply` 的 `cutover.ts` 做只读核验，再带 `--apply`：

```bash
npx tsx --conditions react-server scripts/migrate/content-model/cutover.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --input /absolute/path/review.json --apply --output /absolute/path/cutover.json
```

脚本先排空历史写入并提交整个依赖组的 `readonly` 状态；随后在 serializable 事务中再次锁定、核对最终快照、将映射激活并一起改为 `v2`。组织组不会一部分使用新写源、一部分继续修改旧共享行。

若准备期间旧素材、模型文件 URL、配置、项目归属或成员权限变化，激活被拒绝，组织保留 `readonly`。使用**新 run ID** 重新 audit，复核差异，backfill（可在 readonly 下运行）、verify，再 cutover。即使 Scene JSON 没变，只要其模型版本变了，也会追加模型版本和场景发布快照、重定向 canonical 投放；不会原地修改任何旧快照。

重复已经完成的同 run cutover 是只读幂等返回，不重写上线后的内容。不要运行 backfill 覆盖已经 v2 的组织。

## 6 回退及故障处理

```bash
npx tsx --conditions react-server scripts/migrate/content-model/rollback.ts \
  --environment "$ENVIRONMENT" --organizations "$ORGANIZATIONS" --run-id "$RUN_ID" \
  --input /absolute/path/review.json
```

默认只验证并回滚事务；确认结果后增加 `--apply`。

- 切换前或失败留在 readonly：可恢复旧路由继续修复源数据。影子身份、版本、修订保留，用于复查与再迁移。
- 已切换且无新写入：脚本锁定范围、比对切换时完整内容/ACL/上传指纹，完全一致才恢复 legacy 路由。
- 已有新写入：返回 `V2_WRITES_DETECTED`，保留新内容。应暂时关闭写入后做前向修复，或仅回滚兼容 UI/适配代码；不能重新启用写旧 Asset 的旧服务。
- 数据库锁等待或事务失败：事务内修改回滚；若 readonly 已提交则保持冻结。核对日志与 run 记录，不手工只改一个组织状态绕过核验。
- 执行回退不删除版本和 OSS 文件，也不回滚 M1 的权限修复。旧客户端管理写协议是否可用仍由部署的应用代码控制。

回滚保护是保守判断：即使只是新上传回执或成员权限变更，也会阻止回旧写源。不要通过删除审计、版本或回执来绕过它。

## 7 本地验证

`scripts/test-content-model-migration.ts` 只接受 `127.0.0.1:55439/content_migration`，拒绝现有 55432 开发库，并要求 asset 表为空。用当前 fresh schema 创建专用测试库后运行：

```bash
npx tsx --conditions react-server scripts/test-content-model-migration.ts
```

测试覆盖审核/文件库存守卫、dry-run 无写入、重复幂等、跨组织素材/场景拆分、无坐标 Shop、Anchor、未投放草稿、嵌套 metadata、webm/m4a、完整依赖漂移、旧写入冻结、不可变历史、投放/草稿篡改核验、并发旧事务排空、无新写入回退及新写入后的回退拒绝。脚本保留测试结果，不自动删除数据库。

旧事务快照的单独回归可在同一专用库已有数据时运行，不要求重置：

```bash
npx tsx --conditions react-server scripts/test-content-model-migration.ts --snapshot-guard-only
```

它创建并清理自己的随机 UUID 夹具，验证切换前开启的 REPEATABLE READ 事务在切换后不能修改旧 Asset。此测试必须通过；单靠排空已开始写入的事务不足以阻止仍持旧快照的事务。
