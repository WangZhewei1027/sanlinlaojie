# Asset Pipeline

> 2026-09-08：anchor 已改为「匹配点」，增加一张参考图片和独立特征存储，挂载关系继续使用 anchor_id。具体新流程优先参考 [匹配点与小程序混合识别](./anchor-matching.md)，下文 anchor 的无文件旧流程已被替代。

本文档区分 v2 团队素材流程和 legacy 上传面板。是否启用 v2 由组织 `content_model_state` 决定，见 [数据层](data-layer.md)；`readonly` 禁止提交，`legacy/preparing` 仍使用旧写源。

## V2：上传、素材版本与投放

新流程保留文件预处理能力，提交逻辑使用 `lib/assets/service.server.ts` 与 `lib/assets/versions.server.ts`：

```text
选择/处理文件 → 上传取得 receipt
  → 校验操作者、组织、有效期与用途
  → Asset + AssetVersion + resource 文件清单（团队所有，不创建授权）
  → 可选：同事务创建指向固定版本的 Placement
```

上传完成只代表文件可供提交，不表示素材或投放已创建。`lib/upload/receipts.server.ts` 的回执绑定操作者、团队（组织）、可选合集、key、hash 与用途；工作台上传只传 `organization_id`，上传并投放才同时传合集；有效期内也保护在途文件。版本资源可引用同组织可读取的已有版本文件，以复用物理存储。新版本不会改动已有草稿、发布或投放。

| 入口 | 写入结果 |
| --- | --- |
| 工作台上传 | 团队 Asset 与 v1（`POST /api/organizations/[id]/assets`），不选合集、不默认投放 |
| 场景内上传并添加 | 创建素材后，草稿固定引用所选版本 |
| 上传新版本 | 追加不可变内容、推进 current 指针；使用方主动升级 |
| 现场上传并放置 | 页面内选择地图合集后，一次组合命令创建素材、版本与 Placement；无需创建 Scene |

素材固有信息与投放参数分开：内容、尺寸、时长、动画列表进入 version payload；文件进入 `asset_version_resource`；位置、Anchor、比例/朝向与局部展示参数进入 Placement。EXIF GPS 是采集信息，只有明确的投放操作才用于展示位置。上传和创建命令使用幂等键与回执重试，失败后的文件由 [统一回收](asset-storage-lifecycle.md) 处理。

通用素材目录与 Scene 入口分开。Anchor 和 Shop 仍有专用兼容业务；未来活动附件应继承活动内容的访问范围，不自动成为组织共享素材。

## Legacy 上传面板参考

下文的 `file_url/text_content/metadata` 直写链路仅适用于旧模型。v2 页面和命令不能通过这些旧字段创建第二个写源；文件类型配置和预处理工具可继续复用。

---

## 1. 类型定义

**文件：** `lib/upload/types.ts`、`app/manage/types.ts`

### `UploadType`

所有可上传的资源类型：

```ts
type UploadType =
  | "image" | "video" | "audio" | "document"
  | "link"  | "text"  | "anchor" | "shop" | "model"
```

### `Asset`

Legacy 数据库实体，核心字段：

| 字段 | 说明 |
|------|------|
| `file_type: string` | 对应 `UploadType` 值 |
| `file_url: string \| null` | OSS 公开 URL（`NEXT_PUBLIC_MEDIA_BASE_URL` + `assets/…`；非文件类型为 null） |
| `text_content` | 文本/链接/锚点描述等 |
| `name` | 资源名称（anchor、model、shop 等） |
| `anchor_id` | 关联锚点 ID |
| `tag_ids` | 标签 ID 数组 |
| `is_huge` | 是否大型模型（仅 model） |
| `config.scale_multiplier` | 模型缩放倍率（仅 model） |
| `metadata` | 位置、GPS 来源、尺寸、时长等扩展信息 |

---

## 2. 上传配置

**文件：** `lib/upload/config.ts` → `FILE_TYPE_CONFIGS`

每种类型通过一条配置记录描述其上传行为：

```ts
interface FileTypeConfig {
  type: UploadType
  label: string          // i18n key
  icon: LucideIcon
  accept: string         // HTML input accept 属性
  maxSize?: number       // MB，undefined 表示无限制
  process?: (file) => Promise<File>        // 压缩/转码
  extractMetadata?: (file) => Promise<{}>  // 提取 GPS、尺寸、时长等
}
```

各类型配置一览：

| 类型 | accept | maxSize | process | extractMetadata |
|------|--------|---------|---------|----------------|
| `image` | `image/*` | 5 MB | 压缩至 ≤0.2 MB（JPEG） | GPS + 尺寸 |
| `video` | mp4/mov/webm/avi/mkv/3gp | 3 MB | 无 | 无 |
| `audio` | `audio/*` | 3 MB | 无（Opus/WebM 压缩暂停用，见 `config.ts` TODO） | 时长、采样率等 |
| `document` | pdf/doc/docx/txt/md | 5 MB | 无 | 无 |
| `link` | — | — | — | — |
| `text` | — | — | — | — |
| `anchor` | jpeg/png/webp | 4 MB | 压缩至 ≤1 MB（JPEG） | GPS |
| `shop` | `image/*` | 5 MB | 压缩至 ≤0.2 MB（JPEG） | GPS + 尺寸 |
| `model` | .gltf/.glb | 3 MB | 无 | 无 |

所有 maxSize 均不得超过 `STORAGE_MAX_FILE_SIZE_MB`（5 MB，与 `POST /api/upload` 的硬上限 `MAX_UPLOAD_BYTES` 一致）；统一入口为 `getEffectiveMaxSizeMB()`（`lib/upload/config.ts`），校验在选择文件时一次性完成。

辅助函数：
- `inferUploadType(mimeType)` — 根据 MIME 类型推断 `UploadType`
- `validateFileSize(file, maxSizeMB)` — 校验文件大小

---

## 3. 上传面板

**文件：** `app/manage/components/upload/upload-asset-panel.tsx`

### 3.1 类型显示控制

```
Organization.allowed_file_types（数据库）
  ↓ 有值 → 使用该数组作为 effectiveTypes
  ↓ 无值 → 使用 DEFAULT_UPLOAD_TYPES（lib/upload/types.ts）:
           [image, video, audio, link, text, anchor, shop]

effectiveTypes → FileTypeSelector（Tab 切换）
```

> `document` 与 `model` 不在兜底列表中，需组织显式开启；新建组织写入的默认集合来自 `app_config.default_allowed_file_types`（`/super-admin/settings`）。

### 3.2 上传流程

```
用户操作
  │
  ├─ 文件类型（image/video/audio/document/shop/model）
  │     FileDropzone → processSelectedFile()
  │       ├── uploadService.processFile(file)
  │       │     ├── inferUploadType(file.type)
  │       │     ├── config.extractMetadata?.(file)  → 提取 GPS 等
  │       │     └── config.process?.(file)          → 压缩/转码
  │       └── 若有 GPS → locationSelection.setExifLocation()
  │
  ├─ link  → 直接填写 URL
  ├─ text  → 直接填写文本
  └─ anchor → 填写名称 + 描述（必须有位置）

handleUpload()
  ├── 校验 workspaceId、user
  ├── getFinalLocation() → { location, source }
  ├── 各类型特殊校验（大小、必填字段等）
  ├── uploadService.uploadToStorage(file, userId, { type, workspaceId })
  │     → POST /api/upload（服务端按内容 hash 在组织内去重后写入 OSS）
  └── uploadService.saveToDatabase(workspaceId, userId, result)
        → POST /api/workspaces/[id]/assets 写入 asset 表
```

### 3.3 各类型特殊处理

| 类型 | 特殊逻辑 |
|------|---------|
| `anchor` | 必须有 name 和 location；调用 `saveAnchor()` |
| `link` | 调用 `saveLink()`，无需文件 |
| `text` | 调用 `saveText()`，无需文件 |
| `model` | 跳过 `processFile`，直接上传；3 MB 硬校验 |
| `video` | 跳过 `processFile`，直接上传；3 MB 硬校验 |
| `shop` | 主图 + 可选打卡凭证照片（两次上传） |
| 其余 | 走通用 `processFile` → `uploadToStorage` → `saveToDatabase` |

---

## 4. 资源字段配置

**文件：** `app/manage/config/assetFieldConfig.ts`

每种 `file_type` 对应一个 `AssetTypeConfig`，控制编辑器行为：

```ts
interface AssetTypeConfig {
  editableFields: EditableField[]  // 可编辑的字段列表
  previewType: PreviewType         // 使用哪个预览组件
  fieldLabels?: {...}              // 字段标签 i18n key 覆盖
  fieldPlaceholders?: {...}        // 字段占位符 i18n key 覆盖
}
```

各类型配置：

| 类型 | editableFields | previewType |
|------|---------------|-------------|
| `anchor` | name, text_content, tag_ids, location | `anchor` |
| `text` | name, text_content, anchor_id, tag_ids, location | `text` |
| `image` | name, text_content, anchor_id, tag_ids, location | `image` |
| `audio` | name, text_content, anchor_id, tag_ids, location | `audio` |
| `video` | name, text_content, anchor_id, tag_ids, location | `video` |
| `link` | name, text_content, anchor_id, tag_ids, location | `link` |
| `shop` | name, text_content, anchor_id, tag_ids, location | `image` |
| `model` | name, anchor_id, tag_ids, location, is_huge, scale_multiplier | `model` |
| `default` | tag_ids, location | `none` |

查询函数：
- `getAssetConfig(fileType)` — 获取配置，fallback 到 `default`
- `isFieldEditable(fileType, field)` — 判断字段是否可编辑
- `getFieldLabel(fileType, field, defaultLabel)` — 获取字段标签
- `getFieldPlaceholder(fileType, field, default)` — 获取占位符

---

## 5. 资源编辑器

**文件：** `app/manage/components/AssetEditor/index.tsx`

### 5.1 字段渲染

编辑器通过 `isFieldEditable(file_type, field)` 决定是否渲染每个字段：

| 字段 | 组件 |
|------|------|
| `name` | `AssetNameEditor` |
| `text_content` | `AssetTextEditor`（或 anchor 描述区） |
| `anchor_id` | `AnchorSelector` |
| `tag_ids` | `AssetTagEditor` |
| `location` | `AssetLocationEditor` |
| `is_huge` | Checkbox |
| `scale_multiplier` | Input |

### 5.2 预览组件映射

由 `assetConfig.previewType` 决定渲染哪个预览组件：

| previewType | 组件 | 说明 |
|-------------|------|------|
| `image` | `AssetImagePreview` | 图片展示 + 编辑时可替换 |
| `audio` | `AssetAudioPreview` | HTML5 audio 播放器 |
| `video` | `AssetVideoPreview` | HTML5 video 播放器 |
| `link` | `AssetLinkPreview` | 链接展示 |
| `model` | `AssetModelPreview` | 3D 模型查看器 |
| `text` | `AssetTextEditor`（展示模式） | 文本内容 |
| `anchor` | 描述文本区域 | 锚点描述 |
| `none` | 无预览 | — |

`shop` 类型额外渲染 `AssetCheckinPhotoEditor`（打卡凭证照片）。

### 5.3 保存流程

```
handleSave()
  ├── isFieldEditable("location") → 写入 metadata
  ├── previewType === "image" && imageFile → 上传新图 → 更新 file_url
  ├── file_type === "shop" && checkinFile → 上传 → 写入 metadata.checkin_url
  ├── 各 editableField → 写入 updates 对象
  └── onUpdateAsset(assetId, updates) → 调用父组件回调
```

---

## 6. 数据流总览

```
组织配置（allowed_file_types）
  ↓
上传面板（FileTypeSelector）
  ↓ 用户选择类型
FileDropzone / 文本输入
  ↓
FILE_TYPE_CONFIGS[type].process?.(file)     ← 压缩/转码
FILE_TYPE_CONFIGS[type].extractMetadata?.(file)  ← GPS/尺寸/时长
  ↓
uploadService.uploadToStorage()  →  POST /api/upload → OSS
uploadService.saveToDatabase()   →  POST /api/workspaces/[id]/assets → asset 表
  ↓
AssetManager（资源列表）
  ↓ 用户点击资源
AssetEditor
  ↓
getAssetConfig(file_type)
  ├── editableFields → 渲染可编辑字段
  └── previewType   → 渲染对应预览组件
```

---

## 7. 新增 Asset 类型检查清单

新增媒体类型时，v2 先检查 `lib/content-model/contracts.ts`、`payload.ts` 的类型、资源 role 与 payload 校验，版本 DTO、素材库展示和运行时适配。以下是 legacy 面板与共用上传工具的清单；Activity/Topic 不作为媒体类型加入。

- [ ] `lib/upload/types.ts` — 加入 `UploadType` 联合类型与 `ALL_UPLOAD_TYPES`；按需加入 `DEFAULT_UPLOAD_TYPES`
- [ ] `lib/upload/config.ts` — 在 `FILE_TYPE_CONFIGS` 添加配置项
- [ ] `app/manage/config/assetFieldConfig.ts` — 添加 `assetFieldConfig` 条目；如需新 `previewType`，同步扩展联合类型
- [ ] `app/manage/components/upload/upload-asset-panel.tsx` — 如有特殊上传逻辑，在 `handleUpload` 添加分支
- [ ] `app/manage/components/AssetEditor/` — 如需新预览，创建 `Asset{Type}Preview.tsx` 并在 `index.tsx` 中注册
- [ ] `locales/en.json` + `locales/zh.json` — 添加相关 i18n key
