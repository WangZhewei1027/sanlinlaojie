import "server-only";
import { MatchingError, MAX_MATCH_IMAGE_BYTES } from "@/lib/anchor-matching";
import { assetKeyFromUrl } from "@/lib/storage/public-url";

/** References must be this project's uploaded media (assets/ on our media host), never arbitrary URLs (SSRF). */
export function referenceUrl(value: unknown): URL {
  if (typeof value !== "string") throw new MatchingError("请上传一张匹配图片");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MatchingError("匹配图片地址无效");
  }
  const key = assetKeyFromUrl(value);
  if (
    !key ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new MatchingError("匹配图片必须来自当前项目的媒体存储");
  return url;
}
export async function readReference(url: string): Promise<Blob> {
  const response = await fetch(referenceUrl(url), {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok || !response.body)
    throw new MatchingError("无法读取匹配图片", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MATCH_IMAGE_BYTES)
        throw new MatchingError("匹配图片超过 4 MiB");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return new Blob([Buffer.concat(chunks)], {
    type: response.headers.get("content-type")?.split(";")[0] || "",
  });
}
