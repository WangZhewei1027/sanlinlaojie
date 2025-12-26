/**
 * 音频压缩配置
 * 使用 Opus 编码和 WebM 容器
 */
const COMPRESSION_OPTIONS = {
  mimeType: "audio/webm;codecs=opus",
  audioBitsPerSecond: 64000, // 64kbps - 适合语音，如需音乐可设为 128000
};

const SKIP_COMPRESSION_SIZE = 0.01 * 1024 * 1024; // 0.01MB - 小于此大小跳过压缩

/**
 * 压缩音频文件到 WebM (Opus) 格式
 */
export async function compressToOpusWebM(file: File): Promise<File> {
  // 如果文件已经很小，直接返回
  if (file.size < SKIP_COMPRESSION_SIZE) {
    console.log("音频文件已经小于 0.01MB，跳过压缩");
    return file;
  }

  // 检查浏览器支持
  if (!MediaRecorder.isTypeSupported(COMPRESSION_OPTIONS.mimeType)) {
    console.warn("浏览器不支持 Opus/WebM 编码，返回原文件");
    return file;
  }

  try {
    // 创建 AudioContext 解码音频
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    console.log(
      `原音频信息: ${(file.size / 1024 / 1024).toFixed(2)}MB, ` +
        `时长: ${audioBuffer.duration.toFixed(2)}s, ` +
        `采样率: ${audioBuffer.sampleRate}Hz`
    );

    // 创建 MediaStreamSource
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // 创建 MediaStreamDestination
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);

    // 设置 MediaRecorder
    const mediaRecorder = new MediaRecorder(destination.stream, {
      mimeType: COMPRESSION_OPTIONS.mimeType,
      audioBitsPerSecond: COMPRESSION_OPTIONS.audioBitsPerSecond,
    });

    const chunks: Blob[] = [];

    // 收集数据
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    // 返回 Promise
    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: COMPRESSION_OPTIONS.mimeType });
        resolve(blob);
      };

      mediaRecorder.onerror = (error) => {
        reject(error);
      };

      // 开始录制
      mediaRecorder.start();
      source.start(0);

      // 在音频结束时停止录制
      source.onended = () => {
        mediaRecorder.stop();
        audioContext.close();
      };
    });

    // 创建压缩后的文件
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^/.]+$/, ".webm"),
      {
        type: COMPRESSION_OPTIONS.mimeType,
      }
    );

    console.log(
      `音频压缩完成: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(
        compressedFile.size /
        1024 /
        1024
      ).toFixed(2)}MB ` +
        `(${((compressedFile.size / file.size) * 100).toFixed(1)}%)`
    );

    // 如果压缩后反而更大，返回原文件
    if (compressedFile.size > file.size) {
      console.warn("压缩后文件更大，返回原文件");
      return file;
    }

    return compressedFile;
  } catch (error) {
    console.error("音频压缩失败:", error);
    return file; // 失败时返回原文件
  }
}

/**
 * 获取音频时长（秒）
 */
export async function getAudioDuration(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return audioBuffer.duration;
  } catch (error) {
    console.error("获取音频时长失败:", error);
    return 0;
  }
}

/**
 * 获取音频元数据
 */
export async function extractAudioMetadata(
  file: File
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    };
  } catch (error) {
    console.error("提取音频元数据失败:", error);
    return {}; // 返回空对象而不是 null
  }
}
