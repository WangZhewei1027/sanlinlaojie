# 素材上传与编辑

素材内容在 `asset.payload`，文件在 `asset_resource`；团队拥有素材，地图位置属于 Placement。完整请求结构见 [后端契约](team-workbench-backend-contract.md)，文件保留协议见 [存储生命周期](asset-storage-lifecycle.md)。

## 数据流

```text
选择原文件 → 浏览器校验/读取 GPS → POST /api/upload
  → 团队授权 → 服务端压缩/转码 → 最终字节去重/写 OSS → 上传回执
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

## 浏览器准备与服务端处理

- [lib/upload/policy.ts](../lib/upload/policy.ts) 定义前后端共享的原文件大小上限；`config.ts` 只负责选择器配置，`detection.ts` 负责类型推断。
- [FileUploadService](../lib/upload/service.ts) 先校验原文件，再读取 EXIF GPS；图片和音频字节原样提交，不使用 Canvas、MediaRecorder 或 AudioContext 预处理。
- [content-upload.ts](../app/manage/lib/content-upload.ts) 组装 payload/resources，并读取 GLB 动画目录。GPS 存入 `payload.capture` 表示采集来源，只有显式投放才决定地图位置。
- [上传路由](../app/api/upload/route.ts) 限制整个 multipart 请求为 33 MiB，校验原文件和团队/合集权限，再调用 [服务端媒体处理](../lib/upload/media-processing.server.ts)。最终字节的扩展名、MIME、大小与 SHA-256 用于 OSS 和回执；团队内去重后仍签发绑定调用者的回执。处理失败不会上传原文件作为降级结果。
- [payload.ts](../lib/content-model/payload.ts) 与内容服务校验实际提交，浏览器 accept 和预处理结果不能替代服务端校验。

普通文件使用 primary 资源；匹配图使用 reference；封面、店铺打卡图等有独立资源 role。场景 JSON 是独立 Scene 文档，不作为基础素材类型保存。

## 图片和音频压缩

- 新上传的音频统一为 **MP3 / `audio/mpeg` / 32 kbps CBR / 24 kHz / 单声道**，约 240 KB/分钟，优先减少传输体积。立体声输入混为单声道，会损失声道区别与音乐细节。FFmpeg 使用 libmp3lame 快速档 `compression_level=7`。去除封面和无用元数据，不裁剪静音。有效音轨必须完整解码；时长最多 10 分钟，超长或损坏文件明确拒绝。
- 微信官方 InnerAudioContext 支持表中，iOS/Android 共同支持 M4A、WAV、MP3、AAC；WebAudio 的 decodeAudioData 未单独给出格式矩阵。MP3 是本项目的兼容输出选择，32 kbps 是压缩策略而非微信要求。依据：[官方格式表](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L7074-L7093)、[WebAudio 定义](https://github.com/wechat-miniprogram/api-typings/blob/6092df9100c73b84e140c20b9a42a8e8799e0660/types/wx/lib.wx.api.d.ts#L14825-L14839)（2026-10-29 核实）。真机解码仍需按目标 iOS/Android 验收。
- 普通图片目标 **80 KiB**：最长边 **1024px / JPEG quality 50**，超预算仅再尝试 **768px / quality 40**。匹配图用于识别，独立保留 **256 KiB** 目标：**1280px / quality 65**，必要时 **1024px / quality 50**。每张最多两次编码，替代原来最多 12 次试压缩。sharp 自动按 EXIF 转正、去除文件元数据、不放大小图；透明图输出真彩 PNG（compressionLevel=3），保留缩放后的 alpha，不使用会改动半透明边缘的 palette 量化。动图取首帧作为静态图片。限制输入为 6000 万像素；不支持的格式或损坏数据会返回错误。
- 图片/匹配图/音频原文件最多 **32 MiB**；视频/模型仍为 3 MiB、文档 5 MiB，所有最终存储对象最多 5 MiB，匹配图同时满足识别服务的 4 MiB 上限。图片目标是压缩预算，保留透明度时可能高于预算，但不会越过存储硬上限。
- 每个进程最多同时处理 2 个媒体文件，超出返回可重试的 429。FFmpeg/ffprobe 仅允许本地安全媒体容器，禁止网络与播放列表输入；有超时、输出限制和临时目录清理。生产镜像和 CI 安装 FFmpeg，sharp 为显式服务端依赖。

2026-10-29 本机合成样本基准（每组 3 次中位数）：60 秒音频约 480 KB → 240 KB，编码 277–602 ms → 114–127 ms；普通细节图 147 KB → 49 KB，编码约 111 ms → 50 ms。复杂透明图仍可能大于预算（样本约 1.77 MB → 1.19 MB）；匹配图保留更多像素时体积未必下降。这些数据不代表真实音乐听感、现场识别率或生产机器延时。编码参数依据：[FFmpeg libmp3lame](https://ffmpeg.org/ffmpeg-codecs.html#libmp3lame)、[sharp 输出选项](https://sharp.pixelplumbing.com/api-output/)。

此流程适用于新上传或替换文件，不批量改写历史素材。保留层仍保护同名 .webm/.m4a 文件，兼容既有媒体引用；这项保护不会生成衍生文件。

## 新增素材类型

1. 更新 `lib/content-model/contracts.ts`、payload 校验、资源 role 和服务端读取/写入。
2. 更新上传类型、大小限制及必要的预处理。
3. 更新基础素材详情、地图内容适配和小程序播放协议；涉及小程序时同步其独立仓库。
4. 验证权限、回执、并发覆盖、文件复用及归档后的引用行为。相关脚本包括 `scripts/test-upload-dedup.ts`、`scripts/test-content-model-services.ts` 和 `scripts/test-content-model-contracts.ts`；运行前核对各自的 fixture 与数据库要求。
