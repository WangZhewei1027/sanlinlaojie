# Upload Module

模块化、可扩展的文件上传系统。

## 架构

```
lib/upload/
  ├── types.ts          # 类型定义
  ├── config.ts         # 文件类型配置
  ├── service.ts        # 上传服务
  ├── hooks.ts          # React Hooks
  └── index.ts          # 统一导出

app/manage/components/upload/
  ├── file-dropzone.tsx         # 拖拽 / 点击选择文件
  ├── file-type-selector.tsx    # 文件类型选择器
  ├── location-selector.tsx     # 位置选择器
  └── upload-asset-panel.tsx    # 主上传面板
```

## 特性

### 1. 支持多种文件类型
- **图片** (image): 自动压缩为 JPEG（`lib/image-compression.ts`），提取 EXIF GPS 信息
- **视频** (video): 支持视频上传
- **音频** (audio): 支持音频上传
- **文档** (document): 支持 PDF、Word 等文档
- **链接** (link): 保存外部链接
- **文本** (text): 保存纯文本
- **匹配图** (anchor): 锚点参考图（仅 JPEG / PNG / WebP），必须带位置
- **商铺** (shop): 商铺图片，可附带一张打卡图（`checkinUrl`）
- **模型** (model): glTF / GLB 三维模型

`document` 与 `model` 不在 `DEFAULT_UPLOAD_TYPES` 中，需要组织显式开启（`types.ts`）。

### 2. 模块化设计
- **类型系统**: 完整的 TypeScript 类型定义
- **配置驱动**: 通过 `FILE_TYPE_CONFIGS` 配置不同文件类型
- **服务分离**: 上传逻辑封装在 `FileUploadService` 中
- **组件复用**: 独立的子组件可在其他地方使用

### 3. 可扩展性

#### 添加新文件类型

（以下以假想的 `3d-model` 为例；三维模型现已作为内置的 `model` 类型存在，见 `config.ts`。）

1. 在 `lib/upload/types.ts` 中添加类型，并加入 `ALL_UPLOAD_TYPES`（服务端校验用）：
```typescript
export type UploadType = "image" | "video" | "audio" | "document" | "link" | "text" | "anchor" | "shop" | "model" | "3d-model";
```

2. 在 `lib/upload/config.ts` 中添加配置：
```typescript
"3d-model": {
  type: "3d-model",
  label: "3D模型",
  icon: Cube,
  accept: ".obj,.fbx,.gltf,.glb",
  maxSize: 200,
  process: async (file) => {
    // 自定义处理逻辑
    return file;
  },
  extractMetadata: async (file) => {
    // 提取元数据
    return { format: "gltf" };
  },
}
```

3. 在组件中使用：
```typescript
<FileTypeSelector
  selectedType={uploadType}
  onTypeChange={setUploadType}
  types={["image", "video", "3d-model"]}
/>
```

#### 自定义文件处理

在配置中添加 `process` 函数：
```typescript
process: async (file: File) => {
  // 压缩、转换、优化等
  const processed = await customProcess(file);
  return processed;
}
```

#### 提取自定义元数据

在配置中添加 `extractMetadata` 函数：
```typescript
extractMetadata: async (file: File) => {
  const metadata = await extractCustomData(file);
  return {
    customField: metadata.value,
    timestamp: new Date().toISOString(),
  };
}
```

## 使用方法

### 基础使用

```typescript
import { UploadAssetPanel } from "@/app/manage/components/upload/upload-asset-panel";

// workspace / 点击位置 / 组织均从 useManageStore 读取，不经 props 传入
<UploadAssetPanel
  onUpload={() => {
    console.log("上传成功");
  }}
/>
```

### 使用上传服务

```typescript
import { FileUploadService } from "@/lib/upload";

const uploadService = new FileUploadService();

// 处理文件
const processedFile = await uploadService.processFile(file);

// 经 POST /api/upload 上传到 OSS（服务端按内容 hash 在组织内去重；
// 命中已有对象时 storagePath 为 null，不得对其做补偿删除）
const uploaded = await uploadService.uploadToStorage(processedFile.file, userId, {
  type: processedFile.type,
  workspaceId,
});

// 经 POST /api/workspaces/[id]/assets 创建资产行
await uploadService.saveToDatabase(workspaceId, userId, {
  fileUrl: uploaded.url,
  contentHash: uploaded.contentHash,
  fileType: processedFile.type,
  location,
});
```

### 使用位置选择 Hook

```typescript
import { useLocationSelection } from "@/lib/upload/hooks";

const locationSelection = useLocationSelection(clickedLocation);

// 设置 EXIF 位置
locationSelection.setExifLocation(gpsData);

// 切换选择的来源
locationSelection.setSelectedSource("exif");

// 获取最终位置
const { location, source } = locationSelection.getFinalLocation();
```

## GPS 来源优先级

1. **EXIF GPS**: 从图片 EXIF 数据中提取
2. **用户点击**: 在地图上点击的位置
3. **设备 GPS**: (未来支持) 从设备获取当前位置

用户可以在两个来源之间切换选择。

## 数据结构

### LocationData
```typescript
interface LocationData {
  longitude: number;
  latitude: number;
  height: number;
}
```

### GPSSource
```typescript
interface GPSSource {
  type: "exif" | "user_click" | "device_gps";
  location: LocationData;
  timestamp?: string;
}
```

### UploadResult
```typescript
interface UploadResult {
  fileUrl?: string;
  contentHash?: string;
  fileType: UploadType;
  location?: LocationData;
  gpsSource?: GPSSource["type"];
  tagIds?: string[];
  name?: string;
  textContent?: string;
  checkinUrl?: string;
  metadata?: Record<string, any>;
}
```

## 最佳实践

1. **文件大小限制**: 在配置中设置 `maxSize` 限制文件大小；实际上限为 `min(maxSize, STORAGE_MAX_FILE_SIZE_MB = 5)`（`getEffectiveMaxSizeMB`），服务端 `/api/upload` 同样按 5 MB 拒绝
2. **文件处理**: 对大文件进行压缩或转换
3. **元数据提取**: 提取有价值的元数据保存到数据库
4. **错误处理**: 使用 try-catch 处理上传错误
5. **用户反馈**: 显示上传进度和错误信息

## 未来扩展

- [x] 支持拖拽上传（`file-dropzone.tsx`）
- [ ] 批量上传
- [ ] 上传进度条
- [ ] 设备 GPS 定位
- [ ] 文件预览
- [ ] 云端存储选项 (S3, Azure, etc.)
- [ ] 图片编辑功能
- [ ] 视频转码
