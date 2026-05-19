---
title: 音频格式兼容性方案（浏览器录音 → 小程序播放）
created: 2026-05-18
updated: 2026-05-18
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
  WebM/Opus 压缩（减少上传体积）
      │
      ▼
上传到 Supabase Storage（.webm 文件）
      │
      ▼
[scripts/transcode-webm-to-m4a.ts]
  Cloudinary 转码：WebM → M4A (AAC)
  回传 Supabase Storage（.m4a 文件）
  更新 asset 表 file_url
      │
      ▼
小程序直接读取 .m4a 正常播放
```

### 为什么不在上传前直接转码到 M4A？

浏览器端**无法原生将 Opus 实时转码为 AAC**：

1. `MediaRecorder` 输出格式由浏览器决定，无法指定 AAC 编码器（Safari 除外）。
2. WebAssembly 方案（如 ffmpeg.wasm）可以转码，但对于实时录音存在显著延迟，且 wasm 包体积大（~30MB），严重影响首屏加载。
3. 服务端转码（异步批量）是更稳定、成本更低的方案。

### 为什么先压缩再上传？

`lib/audio-compression.ts` 中的 `compressToOpusWebM` 函数在上传前将录音压缩到 64kbps（语音质量足够），目的是：

- 减少上传流量，节省 Supabase Storage 配额。
- 加快上传速度，改善用户体验（特别是移动端弱网）。
- 即使最终文件会被转码替换，上传阶段用更小的文件依然有价值。

### 为什么选择 Cloudinary 转码？

转码脚本 `scripts/transcode-webm-to-m4a.ts` 使用 Cloudinary 作为转码后端，原因如下：

| 方案 | 优点 | 缺点 |
|---|---|---|
| 浏览器端 ffmpeg.wasm | 无需外部服务 | 包体积大、延迟高、消耗客户端资源 |
| Supabase Edge Function | 无需第三方 | 不适合 CPU 密集型转码，有执行时间限制 |
| 自建转码服务 | 完全控制 | 需要额外运维成本 |
| **Cloudinary** | **API 简单、支持多格式、免费额度充足** | **依赖第三方服务** |

对于当前阶段的用户规模，Cloudinary 免费套餐的转码额度完全满足需求，且无需自建基础设施。

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
1. 扫描 Supabase Storage `assets` bucket 中所有 `.webm` 文件。
2. 逐个上传到 Cloudinary，指定 `format: "m4a"` 触发服务端转码。
3. 下载转码后的 `.m4a` 文件，回传到 Supabase Storage（同路径，替换扩展名）。
4. 更新 `asset` 表中对应记录的 `file_url` 字段。
5. 删除原 `.webm` 文件（可用 `--keep-webm` 跳过）。
6. 清理 Cloudinary 上的临时文件。

**用法：**
```bash
# 转码所有 .webm
npx tsx scripts/transcode-webm-to-m4a.ts

# 预览（不实际执行）
npx tsx scripts/transcode-webm-to-m4a.ts --dry-run

# 限制数量（测试用）
npx tsx scripts/transcode-webm-to-m4a.ts --limit 5

# 保留原始 .webm 文件
npx tsx scripts/transcode-webm-to-m4a.ts --keep-webm
```

---

## 后续音频上传的处理建议

对于新录制的音频，推荐在上传后触发异步转码，而非依赖手动脚本。可选方案：

- **Supabase Database Webhook**：监听 `asset` 表新增记录，触发 Edge Function 调用 Cloudinary 转码。
- **上传后立即调用 API**：在上传完成的回调中，调用一个 Next.js API Route 发起后台转码任务。

目前脚本方案适用于批量历史数据迁移；新增实时转码逻辑时可基于此文档扩展。
