import { NextResponse } from "next/server";
import { authorizeRecognition } from "@/lib/anchor/access.server";
import { recognizeAnchor } from "@/lib/anchor/recognize.server";
import {
  MatchingError,
  MAX_MATCH_IMAGE_BYTES,
  MATCH_IMAGE_TYPES,
  requireUuid,
} from "@/lib/anchor-matching";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const workspaceId = requireUuid(
      new URL(request.url).searchParams.get("workspace_id"),
    );
    await authorizeRecognition(request, workspaceId);
    // Bound the entire multipart body, including chunked uploads, before parsing.
    const reader = request.body?.getReader();
    if (!reader) throw new MatchingError("缺少图片");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_MATCH_IMAGE_BYTES + 65536)
          throw new MatchingError("上传内容超过大小限制", 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const parsed = new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") || "" },
      body: Buffer.concat(chunks),
    });
    let form: FormData;
    try {
      form = await parsed.formData();
    } catch {
      throw new MatchingError("请使用 multipart/form-data 上传");
    }
    const image = form.get("image");
    if (
      !(image instanceof Blob) ||
      !image.size ||
      image.size > MAX_MATCH_IMAGE_BYTES ||
      !MATCH_IMAGE_TYPES.includes(image.type)
    )
      throw new MatchingError("图片须为 JPEG、PNG 或 WebP，且不超过 4 MiB");
    return NextResponse.json(
      { data: await recognizeAnchor(workspaceId, form, image) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof MatchingError ? error.status : 503;
    return NextResponse.json(
      {
        error:
          error instanceof MatchingError
            ? error.message
            : "匹配服务暂不可用，请稍后重试",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(status === 429 ? { "Retry-After": "5" } : {}),
        },
      },
    );
  }
}
