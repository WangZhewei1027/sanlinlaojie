import imageCompression from "browser-image-compression";

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1920,
  fileType: "image/webp" as const,
  maxSizeMB: 0.2, // 200 KB 目标
  useWebWorker: true,
  initialQuality: 0.8,
};

const MAX_RETRIES = 5;
const TARGET_SIZE = 1024 * 1024; // 1MB 目标大小
const SKIP_COMPRESSION_SIZE = COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024; // 200KB

export async function compressToWebP(file: File) {
  // 如果文件已经很小，直接返回
  if (file.size < SKIP_COMPRESSION_SIZE) {
    console.log("文件已经小于 200KB，跳过压缩");
    return file;
  }

  let compressedBlob: Blob | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`第 ${attempt} 次压缩尝试...`);

    compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);

    const sizeKB = (compressedBlob.size / 1024).toFixed(2);
    console.log(`压缩结果: ${sizeKB}KB`);

    // 如果达到目标大小或已达到最大重试次数，停止
    if (compressedBlob.size <= TARGET_SIZE) {
      console.log(`✓ 压缩成功，大小符合要求`);
      break;
    }

    if (attempt < MAX_RETRIES) {
      console.log(`⚠ 文件仍然较大 (${sizeKB}KB)，准备重试...`);
    } else {
      console.warn(`⚠ 已达到最大重试次数 (${MAX_RETRIES})，使用当前压缩结果`);
    }
  }

  const compressedFile = new File(
    [compressedBlob!],
    file.name.split(".")[0] + ".webp",
    {
      type: "image/webp",
    }
  );

  console.log(
    `最终压缩结果: ${(file.size / 1024).toFixed(2)}KB -> ${(
      compressedFile.size / 1024
    ).toFixed(2)}KB`
  );

  return compressedFile;
}
