import { ContentError } from "@/lib/content-model/errors";
import { MAX_MULTIPART_BYTES } from "./policy";
import "server-only";

/** Bound the entire multipart stream before handing it to the form parser. */
export async function readUploadForm(request: Request): Promise<FormData> {
  const tooLarge = () => new ContentError("VALIDATION_FAILED", "上传请求超过大小限制", undefined, 413);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ContentError("VALIDATION_FAILED", "需要上传 multipart/form-data 文件");
  }
  const length = request.headers.get("content-length");
  if (length && Number(length) > MAX_MULTIPART_BYTES) throw tooLarge();
  if (!request.body) throw new ContentError("VALIDATION_FAILED", "缺少文件");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new ContentError("VALIDATION_FAILED", "上传文件格式无效");
  }
}
