# 2026-10-17 本地内容模型迁移审计

**本机 `localhost:55432/sanlin` 已完成回填、核验和切换，56 个组织均为 v2。** 数据保留、运行时样本比对、同项目服务闭环和浏览器场景流程通过；普通 Chrome 中地图新开、刷新及页面往返通过，测试夹具已归档，最终源码的完整检查通过。自动化附着标签存在动态 iframe 的诊断限制，见下文。本次未迁移生产环境，未执行实际 OSS 上传、跨项目 UI 或真机 AR 验收。通用操作步骤见 [迁移操作手册](content-model-migration-runbook.md)。

- Run ID：`1629695b-aebe-4db3-874c-db2422cfd788`
- 备份及证据目录：`/Users/wangzhewei/Working/spatial-memory/.local-db-backups/v2-cutover-20261017-381beb17`
- 完整数据库备份：上述目录的 `before-cutover.dump` 和 `after-cutover.dump`；后者校验记录见 `after-cutover-backup.json`。
- 源记录、审核与运行时基线：`legacy-assets.json`、`archive-scenes.json`、`audit.json`、`review.json`、`runtime-before.json`。
- 资源与演练证据：`inventory.json`、`media-head-results.json`、`rehearsal-backfill.json` 及对应日志。
- 实际切换及保留证据：`backfill-applied.json`、`verify.json`、`cutover-applied.json`、`preservation.json`、`team-preservation.json`。
- 运行时、服务及恢复证据：`runtime-comparison.json`、`service-smoke.json`、`archive-recovery.json`。
- 浏览器证据：`browser-acceptance.json`、`browser-scene-runtime.json`、`browser-fixture-cleanup.json`、`local3000-scene-published.png`、`local3000-final-map.png`、`local3000-native-map.png`、`local3000-native-client-navigation.png`。
- 最终代码检查及源码一致性证据：`final-build-check.log`、`final-verification.json`；`build-check.log` 仅记录前一轮检查。

## 迁移结果

以下数量为旧内容的迁移产物；后续恢复的空草稿及已归档的服务、浏览器夹具另计，不应以当前整表总数替代这些迁移计数。

| 项目 | 已核验结果 |
| --- | --- |
| 组织 / 项目 | 56 / 81 |
| 旧 Asset 源记录 | 2,037 条 |
| 已迁移 | 2,033 条：2,031 个 AssetVersion 和 2 个独立 Scene，各编排生成一个初始修订 |
| 已生成投放 | 1,949 条；按旧发现及 Anchor 关联行为生成 |
| 孤立记录 | 4 条原样保留，待恢复归属，不进入新版发现 |
| Anchor | 22 条独立管理，不为 Anchor 本体创建展示投放 |
| Anchor 关联内容 | 59 条，其中 21 条无 GPS，保留 Anchor 关联路径 |
| 历史无参考图 Anchor | 14 条经审核保留，不补造图片，不放宽正常新建校验 |
| 必需受管对象 | 去重后 1,048 个，HEAD 全部返回 200 |
| 可选音频兼容文件 | 32 个候选 `.m4a` 不存在，不登记为已有资源 |

已修复迁移映射中的高度、模型动画目录及 Anchor 参考图处理。高度保留有限数值的 `metadata.altitude`，缺省时采用旧 `metadata.height`；模型动画目录写入版本快照；Anchor 主参考图按 `reference` 角色登记。克隆库和实际开发库均完成 dry-run、apply、verify 与 cutover；实际切换报告确认上述产物数量及 4 条隔离记录。

`preservation.json` 确认 2,037 条旧 Asset 的旧业务字段逐项保持一致，两个归档实验场景原行完全一致；1,432 条投放的历史高度保留，其中 630 条绝对值超过 0.001 米。`team-preservation.json` 确认 81 个项目、123 条项目分配、160 条组织成员关系和 135 个标签与备份一致；56 个组织除内容模式及切换时间外的字段一致。

`runtime-comparison.json` 比较了 440 条返回记录样本，两个编排的播放内容完全一致。Anchor 识别行单独核对；一条历史链接缺失的配置从未改变的目标地址补齐，其余样本无归一化差异。`service-smoke.json` 验证了创建及发布幂等、素材新版、场景保存发布、固定版本、投放独立更新、过期锁拒绝和公开运行时读取，原素材指纹前后一致。测试素材、场景及两个投放已归档；本轮只测试同项目生命周期，未测试跨项目复用。

## 四条待恢复孤立记录

以下记录均指向已不存在的项目，审核问题为 `no_valid_workspace` 和 `missing_workspace`。源行和备份继续保留，不进入新版发现。后续须先审核归属及内容，再通过受控的 v2 导入恢复；不能根据上传路径或创建者猜测组织归属，也不能把已切换组织改回 legacy 后重跑 backfill。

| 旧 Asset ID | 类型 |
| --- | --- |
| `734e6133-955e-485a-a642-2aabb246c1d7` | text |
| `c788e01e-6369-4aa6-955d-cf038019701b` | image |
| `efdd0efe-64c5-430a-a2ab-8bbbf47362ad` | image |
| `f3b88fd3-1c87-4c5a-b68b-30521b236da5` | image |

## 10 月 11 日实验草稿的恢复结果

`legacy_scene_20261011` 中有两条未发布草稿，均无修订、资源快照及旧转换映射。它们与纳入常规迁移的两个 `Asset(scene)` 编排不同，不能重复导入后者。

两个编排已通过标准迁移保留身份及编排内容：

- `6143939c-f775-4dd0-a820-33408c033518`：`23`。
- `d6fe703f-5b43-41a7-b25e-53ea690b2d8d`：`本地联调 · 双模型动画 1014`。

两条实验草稿已按下列方式处理，结果见 `archive-recovery.json`：

| 实验草稿 | 源内容与恢复结果 |
| --- | --- |
| `test`，`c3ce83f9-950e-4339-89ac-770b430939b1` | 原 `draft_content` 为 `{}`。已通过正常服务恢复为同项目独立空草稿 `9f5e798f-a4de-4b83-bf6c-bb63ef140aca`，未发布、未投放。 |
| `文字`，`6b2325e3-4ab1-4556-b9ba-128247e7ebb6` | 旧 `single_asset` 包装映射到原文字素材 `22a45c97-f804-47aa-a4a9-ea1ad16c02c1`，固定版本 `04ec417c-97ae-5475-a0b5-49d91e36036b`，原投放 `565a0ae6-e265-53a8-a5a6-ce642afadf52`。未伪造 Scene，未创建重复素材或投放。 |

两条草稿均属于项目 `02212116-256b-4b60-9e0c-a5e089862232`。新版 Scene 仅支持模型编排。原始草稿、名称、身份及完整 publication 保留在归档 schema 和 `archive-scenes.json`；恢复清单保存旧新映射。实际结果为两个编排迁移、一个空草稿恢复、文字包装由已有素材及投放承接，不能将其计为两个实验草稿均无损转换为新版 Scene。

## 浏览器验收与代码检查

浏览器在 `localhost:3000` 验证了历史素材列表、素材详情及使用记录，创建新场景并添加同一固定版本的两个实例，第二个实例移动到 X=2，随后保存、发布并创建场景投放。实际小程序场景 HTTP 接口返回 200，播放文档包含两个实例和一个资源别名；这不等同于真机 AR 验收。

| 浏览器验收产物 | ID |
| --- | --- |
| 场景 | `7f42a953-a87b-4130-be11-ef9f96f26ec3` |
| 两实例固定的模型版本 | `6248660a-bc7a-5d0e-ac52-6bb485753326` |
| 发布修订 | `0aa2dd18-6e76-4ada-9f57-e279ae594c18` |
| 场景投放 / 接口公开 ID | `ff9cefb0-8aa3-438c-955c-3712e69130b3` |

验收发现空场景首次添加模型会读取尚未注册到渲染状态的资源，导致 `resource.assetId` 报错。已修复为使用此次选中的资源；`scripts/test-scene-add-model.ts` 回归通过，浏览器重新加载空场景后的首次添加、同版本多实例及保存发布通过。

随后加入 `VIEWER_READY` 握手，在异步 viewer 初始化后补发最新投放状态。包含该变更的最终源码已在构建镜像目录完成 `npm run check`，退出码为 0，覆盖 typecheck、lint、生产构建和 Storybook 构建；最终证据为 `final-build-check.log`。`final-verification.json` 确认 709 项镜像清单中的非文档源码及记录的关键源码哈希与最终检查版本一致。

地图对照验收已通过：通过原生 Chrome 操作，在未由 BrowserTab API 获取或附着的新普通标签中打开实际 `/manage`，地图正常加载；原生 Cmd+R 刷新、场景页返回投放地图的客户端导航均正常。页面可访问性树包含 DJI 地形加载器、CesiumJS iframe、Cesium ion 与 Bing imagery 控件。页面往返后选择旧“小星星⭐️”投放，地图影像及固定 v1 模型预览正常显示，截图为 `local3000-native-map.png` 和 `local3000-native-client-navigation.png`。此前也已验证测试场景定位、地图点击坐标回传、旧模型详情和预览。

自动化附着标签仍可出现动态 iframe 停在 `about:blank`。同一现象在纯静态 HTML 延迟 3 秒添加 iframe、加载既有轻量 post-message 测试页时复现，诊断页面不含 React、业务代码或 Cesium。与普通标签的对照结果支持“自动化附着相关干扰”的判断，**具体 CDP 机制未证实**；不能据自动化标签的失败判定普通浏览器地图全局失败，也不能把正常显示归因于重启或 READY 握手。临时公开诊断页和业务绕过代码已移除，诊断标签已关闭，只保留私有诊断证据。

浏览器测试场景及投放已通过产品 UI 归档；`browser-fixture-cleanup.json` 确认两者均为 archived，原素材和原投放仍为 active，已归档测试投放的公开场景接口返回 404。服务测试夹具也已归档。最终保留校验再次确认 2,037 条旧源记录及两个归档实验原行一致，团队关系一致，56 个组织仍为 v2。

本轮已完成所列素材、场景与普通浏览器地图 UI 流程；自动化附着标签的 iframe 行为作为诊断限制保留。未执行新文件的实际 OSS 上传、跨项目 UI 复用或真机 GPS、相机、AR 验收；HTTP 场景成功不能代替这些验证。

## 执行状态

| 步骤 | 状态 | 证据与范围 |
| --- | --- | --- |
| 完整备份、源导出与审核 | 已完成 | 本记录所列备份目录 |
| 必需对象 HEAD 核验 | 已完成 | `media-head-results.json` |
| 克隆库 backfill dry-run | 已通过，事务已回滚 | `rehearsal-backfill.json` |
| 克隆库 backfill apply / verify | 已通过 | `rehearsal-backfill-applied.json`、`rehearsal-verify.json` |
| 克隆库 cutover | 已完成 | `rehearsal-cutover-applied.json` |
| 实际开发库 backfill / verify | 已通过 | `backfill-applied.json`、`verify.json` |
| 实际开发库 cutover | 已完成，56 个组织为 v2 | `cutover-applied.json`、`preservation.json` |
| 旧内容、团队关系保留 | 已通过 | `preservation.json`、`team-preservation.json` |
| 运行时样本比对 | 已通过 | `runtime-comparison.json`，440 条样本 |
| 同项目服务闭环 | 已通过，夹具已归档 | `service-smoke.json`；2026-10-17 16:52（北京时间） |
| 实验草稿恢复与映射 | 已完成 | `archive-recovery.json`；2026-10-17 16:52（北京时间） |
| 首次添加模型回归 | 已通过 | `scripts/test-scene-add-model.ts`；浏览器空场景重新加载后首次添加成功 |
| 浏览器场景保存、发布、投放 | 已通过 | `browser-acceptance.json`、`local3000-scene-published.png` |
| 浏览器产物的小程序场景接口 | 已通过 | `browser-scene-runtime.json`，HTTP 200、两个实例 |
| 最新代码完整检查（含 READY 握手） | 已通过，退出码 0 | `final-build-check.log`，`npm run check`；旧 `build-check.log` 为前一轮 |
| 浏览器夹具清理 | 已通过 UI 归档并核验 | `browser-fixture-cleanup.json`；原素材及原投放保持 active，测试公开接口 404 |
| 普通浏览器地图 | 新开、刷新及页面往返通过 | 原生 Chrome；`local3000-native-map.png`、`local3000-native-client-navigation.png`，含历史固定 v1 预览 |
| 自动化附着标签的 iframe | 诊断限制 | 静态页面也复现动态 iframe 空白；支持附着相关干扰，具体机制未证实 |
| 清理后最终保留核验 | 已通过 | `preservation.json`、`team-preservation.json` |
| 切换后完整备份 | 已生成并验证归档目录可读 | `after-cutover.dump`、`after-cutover-backup.json` |

## 备份与回退边界

保留迁移前、切换后两份独立快照；归档 schema 仍保留业务外键，不能代替独立 dump。切换后 `after-cutover.dump` 为 2,675,200 字节，`pg_restore --list` 校验通过；SHA-256 为 `c6d127a8a57b6b7362a1fd3ec4e6d42ad7179c547e1b25275505b96b0fa587ba`，记录于 `after-cutover-backup.json`。归档目录可读不等同于切换后备份已完成全量恢复演练。

迁移不以删除旧行或对象文件完成；四条孤立记录及实验原文继续保留。恢复 dump 应先在隔离库核验，覆盖实际开发库会覆盖备份之后的新写入，不能作为默认回退动作。

切换后只有在完整内容、权限及上传指纹未变化时才能执行受限旧路由回退。本库已通过正常服务恢复空草稿并完成创建、版本及投放测试，存在新版写入；即使测试夹具已归档，也不恢复为“无新版写入”。后续采用前向修复或审核后的 v2 导入，不手工改回 legacy，不重跑 backfill 覆盖当前内容。`V2_WRITES_DETECTED` 应保持阻断，不得删除审计、版本或幂等记录来绕过保护。
