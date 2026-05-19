# Asset Pipeline

本文档描述 sanlinlaojie 管理端中任意类型资源（Asset）从配置到上传、编辑、预览的完整处理链路。

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

数据库实体，核心字段：

| 字段 | 说明 |
|------|------|
| `file_type: string` | 对应 `UploadType` 值 |
| `file_url: string \| null` | Supabase Storage URL（非文件类型为 null） |
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
| `image` | `image/*` | 10 MB | 压缩至 0.2 质量 | GPS + 尺寸 |
| `video` | mp4/mov/webm/avi/mkv/3gp | 3 MB | 无 | 无 |
| `audio` | `audio/*` | 50 MB | 转码为 Opus/WebM | 时长、采样率等 |
| `document` | pdf/doc/docx/txt/md | 20 MB | 无 | 无 |
| `link` | — | — | — | — |
| `text` | — | — | — | — |
| `anchor` | — | — | — | — |
| `shop` | `image/*` | 10 MB | 压缩至 0.2 质量 | GPS + 尺寸 |
| `model` | .gltf/.glb | 3 MB | 无 | 无 |

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
  ↓ 无值 → 使用 defaultTypes:
           [image, video, audio, link, text, anchor, shop]

effectiveTypes → FileTypeSelector（Tab 切换）
```

> `model` 不在默认列表中，需组织显式开启。

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
  ├── uploadService.uploadToStorage(file, userId)   → Supabase Storage
  └── uploadService.saveToDatabase(workspaceId, userId, result)
        → assets 表插入记录
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
uploadService.uploadToStorage()  →  Supabase Storage
uploadService.saveToDatabase()   →  assets 表
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

需要新增一种 `file_type` 时，依次检查以下位置：

- [ ] `lib/upload/types.ts` — 加入 `UploadType` 联合类型
- [ ] `lib/upload/config.ts` — 在 `FILE_TYPE_CONFIGS` 添加配置项
- [ ] `app/manage/config/assetFieldConfig.ts` — 添加 `assetFieldConfig` 条目；如需新 `previewType`，同步扩展联合类型
- [ ] `app/manage/components/upload/upload-asset-panel.tsx` — 按需加入 `defaultTypes`；如有特殊上传逻辑，在 `handleUpload` 添加分支
- [ ] `app/manage/components/AssetEditor/` — 如需新预览，创建 `Asset{Type}Preview.tsx` 并在 `index.tsx` 中注册
- [ ] `locales/en.json` + `locales/zh.json` — 添加相关 i18n key
