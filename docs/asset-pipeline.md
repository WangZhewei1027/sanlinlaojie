# 素材上传与编辑

素材内容在 `asset.payload`，文件在 `asset_resource`；团队拥有素材，地图位置属于 Placement。完整请求结构见 [后端契约](team-workbench-backend-contract.md)，文件保留协议见 [存储生命周期](asset-storage-lifecycle.md)。

## 数据流

```text
选择文件 → 浏览器预处理 → POST /api/upload → 上传回执
  → 创建/修改团队素材的 payload 和 resources
  → 按需在合集创建 Placement，或在 Scene 中引用 assetId
```

上传完成只代表文件可供业务提交，不代表素材或投放已创建。`content-upload.ts` 用回执构造资源输入；服务端验证调用者、团队、有效期和用途，并在事务内建立引用。

| 入口 | 提交行为 |
| --- | --- |
| 基础素材上传 | `POST /api/organizations/[id]/assets`，无需合集 |
| 编辑或替换文件 | `PATCH /api/assets/[id]`，携带 `expectedLockVersion`，原子更新 payload 和 resources |
| 场景添加模型 | 选择或创建团队模型素材，再将 assetId 写入场景；保存场景后生效 |
| 地图/现场上传并投放 | 回执可携带合集，`POST /api/collections/[id]/placements` 在同一事务创建素材与投放 |

素材编辑会影响所有引用它的场景与投放，不存在另行发布或升级投放的步骤。文件复用通过上传回执或经授权的 `fromAssetId` 资源输入完成；物理去重不合并业务身份。

## 浏览器处理与服务端校验

- [lib/upload/config.ts](../lib/upload/config.ts) 定义类型、accept、大小和预处理；有效上限由 `getEffectiveMaxSizeMB` 计算。
- [FileUploadService](../lib/upload/service.ts) 在压缩前读取 EXIF，再处理文件并校验大小；不写数据库。
- [content-upload.ts](../app/manage/lib/content-upload.ts) 组装 payload/resources，并读取 GLB 动画目录。GPS 存入 `payload.capture` 表示采集来源，只有显式投放才决定地图位置。
- [上传路由](../app/api/upload/route.ts) 校验团队/合集权限、最终字节大小与 hash；团队内去重后仍签发绑定调用者的回执。
- [payload.ts](../lib/content-model/payload.ts) 与内容服务校验实际提交，浏览器 accept 和预处理结果不能替代服务端校验。

普通文件使用 primary 资源；匹配图使用 reference；封面、店铺打卡图等有独立资源 role。场景 JSON 是独立 Scene 文档，不作为基础素材类型保存。

## 音频边界

当前 audio 配置没有启用 `compressToOpusWebM`，上传流程也没有自动转成 M4A 的步骤。本仓库不再提供旧批量转码脚本，不能把上传成功视为小程序播放兼容性已验证。音频需要在实际目标客户端验证播放。

保留层仍保护同名 .webm/.m4a 文件，兼容既有媒体引用；这项保护不会生成衍生文件。

## 新增素材类型

1. 更新 `lib/content-model/contracts.ts`、payload 校验、资源 role 和服务端读取/写入。
2. 更新上传类型、大小限制及必要的预处理。
3. 更新基础素材详情、地图内容适配和小程序播放协议；涉及小程序时同步其独立仓库。
4. 验证权限、回执、并发覆盖、文件复用及归档后的引用行为。相关脚本包括 `scripts/test-upload-dedup.ts`、`scripts/test-content-model-services.ts` 和 `scripts/test-content-model-contracts.ts`；运行前核对各自的 fixture 与数据库要求。
