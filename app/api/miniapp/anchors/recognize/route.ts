import { NextResponse } from "next/server";
import { recognizeAnchor } from "@/lib/anchor/recognize.server";
import {
  MatchingError,
  MAX_MATCH_IMAGE_BYTES,
  MATCH_IMAGE_TYPES,
  requireUuid,
} from "@/lib/anchor-matching";

// The mini-program sends X-Recognition-Request-Id (same grammar as the former
// Edge Function); it is echoed in the JSON and the response header so client
// and server logs can be correlated.
const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestedId = request.headers.get("X-Recognition-Request-Id");
  const requestId =
    requestedId && REQUEST_ID_RE.test(requestedId) ? requestedId : crypto.randomUUID();
  const baseHeaders = {
    "Cache-Control": "no-store",
    "X-Recognition-Request-Id": requestId,
  };
  try {
    if (requestedId !== null && !REQUEST_ID_RE.test(requestedId))
      throw new MatchingError("Invalid X-Recognition-Request-Id");
    const workspaceId = requireUuid(
      new URL(request.url).searchParams.get("workspace_id"),
    );
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
    const parsedAt = performance.now();
    const data = await recognizeAnchor(workspaceId, form, image, requestId);
    data.diagnostics.timings_ms.request_parse_ms = Math.round(parsedAt - startedAt);
    data.diagnostics.timings_ms.api_total_ms = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      { data: { ...data, request_id: requestId } },
      { headers: baseHeaders },
    );
  } catch (error) {
    const matchingError = error instanceof MatchingError ? error : null;
    const status = matchingError?.status ?? 503;
    const retryAfterSeconds =
      status === 429 ? (matchingError?.retryAfterSeconds ?? 5) : undefined;
    return NextResponse.json(
      {
        error: matchingError?.message ?? "匹配服务暂不可用，请稍后重试",
        ...(matchingError?.code ? { code: matchingError.code } : {}),
        ...(retryAfterSeconds !== undefined
          ? { retry_after_ms: retryAfterSeconds * 1000 }
          : {}),
        request_id: requestId,
        diagnostics: {
          timings_ms: { api_total_ms: Math.round(performance.now() - startedAt) },
        },
      },
      {
        status,
        headers: {
          ...baseHeaders,
          ...(retryAfterSeconds !== undefined
            ? { "Retry-After": String(retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
