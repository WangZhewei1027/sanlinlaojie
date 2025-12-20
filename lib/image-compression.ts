import imageCompression from "browser-image-compression";

export async function compressToWebP(file: File) {
  const options = {
    maxWidthOrHeight: 1920,
    fileType: "image/webp",
    maxSizeMB: 0.2, // 200 KB 上限，可调
    useWebWorker: true,
  };

  const compressedBlob = await imageCompression(file, options);

  return new File([compressedBlob], file.name.split(".")[0] + ".webp", {
    type: "image/webp",
  });
}
