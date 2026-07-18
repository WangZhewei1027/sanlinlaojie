# Asset 存储生命周期：内容 hash 去重与删除机制

本文档描述 assets 存储桶中文件的完整生命周期：内容 hash 全局去重如何让多个资产共享同一个存储对象，以及在这种共享关系下，各删除路径如何保证"不误删仍被引用的文件、不留下指向已删文件的死链"。

上传链路的类型配置与处理流程见 [asset-pipeline.md](./asset-pipeline.md)。

---

## 1. 内容 hash 去重机制

### 1.1 原理

**文件：** `lib/upload/service.ts`、`app/api/assets/by-hash/route.ts`

上传文件时，客户端对**处理/压缩后的最终字节**计算 SHA-256（十六进制串），存入 `asset.content_hash` 列（迁移 `20260712000000_asset_content_hash.sql`，带索引；link/text/anchor 等无文件类型为 NULL）。

上传流程：

```
processFile（压缩/提元数据）
  → computeContentHash（SHA-256）
  → GET /api/assets/by-hash?hash=…      ← 查全表是否已有相同内容
      命中 → 直接复用已有 file_url，跳过存储上传
      未命中 → 上传到 assets/{userId}/{时间戳-随机串}.{ext}，记录新 URL
  → 创建 asset 行（file_url + content_hash）
```

### 1.2 去重是全局的，跨组织无边界

`by-hash` 查询不过滤组织：任何登录用户上传的文件，只要内容与**任何组织**已有文件相同，就复用同一个 `file_url`。这是有意设计——assets 桶为 public、asset 表可匿名读，复用 URL 不暴露新信息，却能避免相同素材重复存储。

由此产生三个必须时刻记住的事实：

1. **多个 asset 行（可能属于不同组织）共享同一个存储对象。** 复制素材（`/api/assets/copy`）同样复用源的 `file_url`/`content_hash`，进一步放大共享。
2. **文件物理上存放在首个上传者的 `{userId}/` 目录下**，与后续引用它的资产属于谁无关。目录结构不能推断归属。
3. **同一存储对象可能被两种字段引用：** 普通资产的 `file_url`，以及 shop 素材的 `metadata.checkin_url`（打卡图也走同一条去重上传链路）。判断"文件是否还有人用"必须同时检查两处。

### 1.3 引用计数

**文件：** `lib/storage-cleanup.server.ts`

删除存储文件前的唯一判据是引用计数：

- `countFileReferences(url)`：对 `file_url` 与 `metadata->>checkin_url` 各做一次 `count: "exact", head: true` 计数并求和。count 模式不受 PostgREST 1000 行截断影响。
- `removeStorageFileIfUnreferenced(url, ctx)`：计数为 0 才调 `storage.remove`；失败不抛错，记入 `error_log` 后返回 `"failed"`，残留文件交给全局清扫兜底（见 §3）。

批量场景（整组织清除）不逐个 count，而是用 `fetchAllRows` 分页拉全量的批量 `in` 查询（`findStillReferencedUrls`），语义等价。**任何新的删除代码都不得绕过这套引用计数直接删文件。**

---

## 2. 删除机制

### 2.1 总原则：先删行、后删文件

所有删除路径统一遵守这个顺序，理由是两个失败方向的严重性完全不对称：

| 失败方向 | 后果 | 可恢复性 |
|----------|------|----------|
| 行删了、文件删失败 | 孤儿文件（无行引用、用户不可见） | 可由全局清扫兜底删除 |
| 文件删了、行删失败 | 死链行（用户可见的坏数据，且文件不可恢复） | 不可恢复 |

因此永远让失败落在"孤儿文件"一侧。存储删除失败一律**不阻断主流程**，只记 `error_log`。

### 2.2 各删除路径一览

| 路径 | 入口 | 行为 |
|------|------|------|
| 单资产删除 | `DELETE /api/assets/[id]` | 鉴权（资产横跨的每个 org 都需 `org.assets.write`）→ 删行 → 对 `file_url` 与 `metadata.checkin_url` 各做引用计数清理 |
| 换文件回收 | `PATCH /api/assets/[id]` | 更新行后，若 `file_url` / `metadata.checkin_url` 被替换，对旧 URL 做引用计数清理 |
| 删 workspace | `DELETE /api/workspaces/[id]` | **不碰存储**。仍有资产引用该 workspace 时直接拒绝（400），必须先删资产 |
| 删组织（普通） | `DELETE /api/organizations/[id]` | **不碰存储**。仍有 workspace 时直接拒绝（400） |
| 整组织清除 | `purgeOrganizations`（`lib/user-deletion.server.ts`） | 见 §2.3 |
| 兜底清扫 | `POST /api/admin/clean` | 见 §3 |

`purgeOrganizations` 有三个调用方：

- super-admin 删组织（`app/super-admin/organizations/actions.ts` 的 `deleteOrganization`）；
- 删用户（`DELETE /api/users/[id]`）：用户是某组织唯一成员时级联整删该组织（预览与执行共用 `computeUserDeletionPlan`）；
- 存量迁移 `20260714000001_cleanup_orphan_orgs.sql`（纯 SQL 直调 RPC，不删存储，文件残留靠清扫兜底）。

### 2.3 整组织清除的资产语义

`asset.workspace_id` 是 `uuid[]`（资产可横跨多个 workspace/组织，无外键），所以整删组织时必须区分两类资产：

- **完全包含**（`workspace_id` 非空且 ⊆ 被删 workspace 集合）→ 删行；
- **跨组织**（数组与被删集合有交集但不被包含）→ 只从数组里剥离被删的 workspace id，行保留。

流程（`purgeOrganizations`）：

```
1. 收集候选文件 URL：完全包含资产的 file_url + checkin_url
   （fetchAllRows 分页拉全量——行删掉后就查不到了，必须先收集）
2. RPC purge_organizations：单事务原子删除 包含资产行 / workspace / 组织，
   剥离跨组织资产的 workspace id（SQL 见 20260714000000_user_deletion_fns.sql）
3. 行删完后，对候选 URL 做 findStillReferencedUrls：
   仍被任何剩余行引用（= 外部组织在用）的 URL 保留，其余批量删除存储文件
```

第 3 步在行删除**之后**做引用检查，是刻意的：此时"仍被引用"天然等于"外部在用"，无需再维护"包含集合内/外"的差集逻辑，正确性只依赖引用计数一条规则。

### 2.4 历史缺陷（已修复，防止回归）

以下问题已在 2026-07 修复，列出以防同类代码再次出现：

1. **引用查询无分页**：旧 `collectDeletableFilePaths` 用 `.in("file_url", batch)` 不分页，命中行数超 1000 时 PostgREST 静默截断，外部引用落在截断尾部会被漏判 → 误删其他组织仍在用的共享文件。**教训：任何拉行做集合判断的查询必须 `fetchAllRows` 分页；只需要数量就用 count 模式。**
2. **先删文件后删行**：反向失败会留死链。
3. **只按 `file_url` 计数**：漏掉 `metadata.checkin_url` 的引用，可能误删仍被 shop 素材使用的打卡图。
4. **换文件不回收旧文件**：编辑器重传图片只改 `file_url`，旧文件永久泄漏。
5. **清扫器路径错配**：旧 clean-files 按 `{workspaceId}/` 列目录，实际文件在 `{userId}/` 下，清扫器从未真正工作；且只对比本 workspace 的引用，若命中会误删跨组织共享文件。

---

## 3. 兜底：全局清扫器

**文件：** `app/api/admin/clean/route.ts`，页面 `/super-admin/clean`（仅 super_admin）

清扫器是 §2.1 "存储失败不阻断" 策略的配套兜底，两种模式：

### clean-rows（死链行清理，按 workspace）

分页拉取所选 workspace 下所有带 `file_url` 的资产，逐个确认存储文件是否存在；文件确实不存在的行删除。注意：**列目录失败 ≠ 文件不存在**——storage 瞬时故障时跳过该资产并记入 errors，绝不能把查询失败当成文件缺失而误删行。

### clean-files（孤儿文件清理，全桶）

```
递归列出 assets 桶全部文件（分页 + 子目录下钻）
  − 全表引用集合（所有行的 file_url + metadata.checkin_url 解析出的桶内路径）
  − 24 小时内的新文件（上传先于行落库，可能是进行中的上传）
  = 孤儿文件 → 删除
```

必须全桶、全表对比：hash 去重让文件可被任意组织的资产引用，任何缩小对比范围的"优化"都会重新引入误删。

### 孤儿文件的正常来源

- 各删除路径中 `storage.remove` 失败（已记 `error_log`）；
- 行删除成功后进程中断，文件清理未执行；
- `cleanup_orphan_orgs` 这类纯 SQL 清理（SQL 删不了 Storage）；
- 客户端上传成功但创建 asset 行失败/放弃。

孤儿文件不可见、无害，定期跑一次 clean-files 即可回收。

---

## 4. 已知边界

- **TOCTOU 竞态**：引用计数与 `storage.remove` 之间没有事务保护。极端情况下，删除进行中恰有用户 by-hash 命中同一文件（跳过实际上传），新行会指向刚被删除的文件。窗口为毫秒级，实际风险低；彻底解决需要 DB 级锁或独立去重表，目前评估复杂度收益不成比例，接受此风险。clean-files 的 24 小时保护窗已挡住清扫一侧的同类竞态。
- **去重与私有化互斥**：全局去重成立的前提是"桶 public + 表匿名可读，一切本来就公开"。若未来要做私有桶或按组织隔离访问，必须同步把去重收敛到组织级（如 `(organization_id, content_hash)`），否则 by-hash 通道本身就是越权读取的后门。
- **计费归属模糊**：文件存放在首个上传者目录下，后来者零成本引用。若未来按存储量计费，需要另行设计归属模型。
