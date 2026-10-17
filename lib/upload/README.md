# 文件处理与版本上传

`FILE_TYPE_CONFIGS` 定义上传类型、大小限制、浏览器处理和元数据提取。
`FileUploadService.processFile` 负责压缩及读取 EXIF，不创建数据库内容。

`app/manage/lib/content-upload.ts` 将处理后的文件交给 `/api/upload`，请求必须指定团队，地图上传还可指定合集。服务端按团队去重，返回绑定调用者与团队的上传回执。正常素材使用 `primary` 资源，匹配点使用 `reference` 资源，统一提交为不可变 AssetVersion。

- 团队素材：`POST /api/organizations/[id]/assets`。
- 新版本：`POST /api/assets/[id]/versions`。
- 上传并投放：`POST /api/collections/[id]/placements`，一个事务内建立素材、版本和独立投放。
- 场景：`POST /api/organizations/[id]/scenes`，使用固定版本引用的 schema 3 文档。

GPS 提取结果是拍摄信息；只有用户明确选择位置时才写入地图投放。上传失败重试复用同一提交意图的回执和幂等键。文件回收统一通过 `lib/storage/retention.server.ts` 检查版本、回执和保留记录，不能直接删除去重复用的对象。
