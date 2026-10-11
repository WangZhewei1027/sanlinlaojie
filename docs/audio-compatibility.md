---
title: 音频格式兼容性方案（浏览器录音 → 小程序播放）
created: 2026-05-18
updated: 2026-10-09
---

# 音频格式兼容性方案

## 背景与问题

### 浏览器端的限制

浏览器原生录音（`MediaRecorder` API）在绝大多数现代浏览器（Chrome、Edge、Firefox）中只支持输出 **WebM 容器 + Opus 编解码器**（`audio/webm;codecs=opus`）。Safari 支持 MP4/AAC，但不支持 Opus。

这一格式对于 Web 端播放没有问题，但会造成跨平台兼容问题。

### 微信小程序的限制

微信小程序的 `<audio>` 组件和 `wx.createInnerAudioContext()` 对音频格式有严格限制：

| 格式 | 小程序支持 |
|---|---|
| MP3 | ✅ |
| AAC / M4A | ✅ |
| WAV | ✅ |
| WebM / Opus | ❌ |
| OGG | ❌ |

直接将浏览器录制的 `.webm` 文件上传后，在小程序中播放会**静默失败**（无错误提示，仅无声）。

---

## 各端播放格式要求

### Web 端（浏览器）

浏览器对音频格式的包容性较高，以下格式均可直接播放：

| 格式 | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WebM / Opus | ✅ | ✅ | ❌ | ✅ |
| MP3 | ✅ | ✅ | ✅ | ✅ |
| AAC / M4A | ✅ | ✅ | ✅ | ✅ |
| WAV | ✅ | ✅ | ✅ | ✅ |
| OGG | ✅ | ✅ | ❌ | ✅ |

**结论：** 上传 `.webm` 在 Web 端几乎没有问题（Safari 除外）。若需要兼容 Safari Web 端，也需要转为 MP3 / M4A。

### 微信小程序端

小程序对格式要求严格，且**不支持动态解码 WebM/Opus**。若希望音频上传后**无需任何服务端转码、直接在小程序播放**，需要在客户端本地预先处理成以下格式之一：

| 推荐格式 | 说明 |
|---|---|
| **M4A（AAC 编码）** | 首选，体积小、音质好、小程序/iOS/Android 全兼容 |
| MP3 | 兼容性最广，但同等码率下体积略大于 AAC |
| WAV | 无损但体积极大，不适合移动端 |

**本地处理方案（用户手动转换）：**

如果音频文件是在录音设备或电脑上预先准备好的（而非在浏览器中实时录制），可以在上传前使用以下工具手动转换为 M4A：

| 工具 | 平台 | 用法 |
|---|---|---|
| [格式工厂](http://www.pcgeshi.com/) | Windows | 图形界面，拖入文件选择 M4A 输出即可 |
| [HandBrake](https://handbrake.fr/) | Win / Mac | 开源，支持批量，选 AAC 编码输出 |
| [ffmpeg](https://ffmpeg.org/)（命令行） | 全平台 | `ffmpeg -i input.webm -c:a aac output.m4a` |
| macOS 自带"音频 MIDI 设置" / QuickTime | macOS | 导出时选择 M4A 格式 |

转换后直接上传 `.m4a` 文件，小程序端即可正常播放，无需任何服务端转码。

**当前项目的取舍：** 浏览器实时录音场景无法要求用户手动转换，因此选择上传 WebM 后由服务端批量转码（见下方流程）。

---

## 解决方案设计

### 整体流程

```
用户在浏览器录音
      │
      ▼
[lib/audio-compression.ts]
  WebM/Opus 压缩（减少上传体积；目前在 lib/upload/config.ts 中暂时停用）
      │
      ▼
经 POST /api/upload 上传到 OSS（.webm 文件）
      │
      ▼
[scripts/transcode-webm-to-m4a.ts]
  本机 ffmpeg 转码：WebM → M4A (AAC)
  回传 OSS（同一 key，仅扩展名改为 .m4a）
  更新 asset 表 file_url
      │
      ▼
小程序把 .webm URL 同路径替换为 .m4a 后直接播放
```

### 为什么不在上传前直接转码到 M4A？

浏览器端**无法原生将 Opus 实时转码为 AAC**：

1. `MediaRecorder` 输出格式由浏览器决定，无法指定 AAC 编码器（Safari 除外）。
2. WebAssembly 方案（如 ffmpeg.wasm）可以转码，但对于实时录音存在显著延迟，且 wasm 包体积大（~30MB），严重影响首屏加载。
3. 服务端转码（异步批量）是更稳定、成本更低的方案。

### 为什么先压缩再上传？

`lib/audio-compression.ts` 中的 `compressToOpusWebM` 函数在上传前将录音压缩到 64kbps（语音质量足够），目的是：

> 注意：`lib/upload/config.ts` 中 audio 类型的 `process: compressToOpusWebM` 目前被注释掉（待压缩模块稳定后恢复），当前上传的是浏览器录制的原始 WebM。

- 减少上传流量，节省 OSS 存储与流量。
- 加快上传速度，改善用户体验（特别是移动端弱网）。
- 即使最终文件会被转码替换，上传阶段用更小的文件依然有价值。

### 转码后端：本机 ffmpeg

转码脚本 `scripts/transcode-webm-to-m4a.ts` 直接调用运行脚本那台机器上的 `ffmpeg`（`-c:a aac -b:a 128k -movflags +faststart`），不依赖任何第三方转码服务。

> 历史：Supabase / Vercel 时期该脚本使用 Cloudinary 作为转码后端；2026-10-01 迁移到阿里云自托管后改为本机 ffmpeg。

---

## 文件说明

### `lib/audio-compression.ts`

客户端压缩库，在用户完成录音后、上传前调用。

- `compressToOpusWebM(file)` — 将任意音频文件重编码为 WebM/Opus 64kbps
- `getAudioDuration(file)` — 获取音频时长
- `extractAudioMetadata(file)` — 提取采样率、声道数等元数据

压缩逻辑：通过 `AudioContext` 解码原始音频，再用 `MediaRecorder` 以目标参数重新录制到 `MediaStreamDestination`，最终输出 Blob。

> 若压缩后文件反而更大（如原始录音已是低码率），函数会自动返回原文件。

### `scripts/transcode-webm-to-m4a.ts`

批量转码脚本，在数据库中存在 `.webm` 文件时手动执行（一次性迁移或补录场景）。

**执行步骤：**
1. 查询 `asset` 表中 `file_type = 'audio'` 且 `file_url` 以 `.webm` 结尾的记录（按 URL 去重，只处理位于本站 OSS 的对象）。
2. 下载原文件，用本机 ffmpeg 转码为 M4A（AAC 128k）。
3. 上传到 OSS 的同一 key（仅扩展名换成 `.m4a`）；该 `.m4a` 已存在时跳过下载/转码/上传，只补做数据库更新，脚本可安全重跑。
4. 更新 `asset` 表中对应记录的 `file_url` 字段。
5. 默认保留原 `.webm` 文件；仅在显式传入 `--delete-webm` 时从 OSS 删除。
6. 清理本地临时目录。

**前置条件：** 本机 PATH 中有 `ffmpeg`；`.env.local` 中配置 `DATABASE_URL`、`OSS_BUCKET`、`OSS_REGION`、`ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET`、`NEXT_PUBLIC_MEDIA_BASE_URL`。脚本引用了带 `server-only` 守卫的 `lib/db` 与 `lib/storage/oss`，必须带 `--conditions react-server` 运行。

**用法：**
```bash
# 转码所有 .webm
npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts

# 预览（不实际执行）
npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --dry-run

# 限制数量（测试用）
npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --limit 5

# 转码成功后删除原始 .webm 文件（默认保留）
npx tsx --conditions react-server scripts/transcode-webm-to-m4a.ts --delete-webm
```

---

## 后续音频上传的处理建议

对于新录制的音频，推荐在上传后触发异步转码，而非依赖手动脚本。可选方案：

- **服务端异步任务**：监听 `asset` 表新增的音频记录，由服务器端任务调用 ffmpeg 转码。
- **上传后立即调用 API**：在上传完成的回调中，调用一个 Next.js API Route 发起后台转码任务。

目前脚本方案适用于批量历史数据迁移；新增实时转码逻辑时可基于此文档扩展。
