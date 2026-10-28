# 文件上传模块

`FILE_TYPE_CONFIGS` 定义类型、大小限制及浏览器预处理；`FileUploadService.processFile` 只处理文件。业务提交由 `app/manage/lib/content-upload.ts` 连接上传回执和当前素材内容。

完整流程统一见 [素材上传与编辑](../../docs/asset-pipeline.md)，文件复用与回收见 [存储生命周期](../../docs/asset-storage-lifecycle.md)。
