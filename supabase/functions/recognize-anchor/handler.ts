import { Config, Diagnostics, IMAGE_LIMIT, IMAGE_TYPES, RecognitionError, REQUEST_BUDGET_MS, isTimeout, readBounded, safeRequestId, withBudget, workspaceId } from "./protocol.ts";
import { recognize } from "./matching.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Recognition-Request-Id, x-region",
  "Access-Control-Expose-Headers": "X-Recognition-Request-Id, Retry-After",
};
export function createRecognitionHandler(config: Config, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    const requestConfig: Config = { ...config, deadlineAtMs: Math.min(
      config.deadlineAtMs ?? Infinity, startedAt + REQUEST_BUDGET_MS,
    ) };
    const requestedId = request.headers.get("X-Recognition-Request-Id");
    const requestId = safeRequestId(requestedId) || crypto.randomUUID();
    const diagnostics: Diagnostics = { timings_ms: {}, phase: "request_parse", request_id: requestId,
      ...(safeRequestId(config.edgeRegion) ? { edge_region: config.edgeRegion } : {}) };
    const headers = { ...CORS, "Cache-Control": "no-store", "X-Recognition-Request-Id": requestId };
    const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", ...extra } });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      if (requestedId !== null && !safeRequestId(requestedId)) throw new RecognitionError("Invalid X-Recognition-Request-Id");
      if (request.method !== "POST") throw new RecognitionError("请使用 POST 请求", 405);
      const workspace = workspaceId(new URL(request.url).searchParams.get("workspace_id"));
      const form = await withBudget(requestConfig, REQUEST_BUDGET_MS, async (signal) => {
        const bytes = await readBounded(request.body, IMAGE_LIMIT + 65536, signal);
        try {
          return await new Request(request.url, { method: "POST", headers: {
            "Content-Type": request.headers.get("Content-Type") || "",
          }, body: bytes.buffer as ArrayBuffer }).formData();
        } catch (error) {
          if (isTimeout(error)) throw error;
          throw new RecognitionError("请使用 multipart/form-data 上传");
        }
      });
      const image = form.get("image");
      if (!(image instanceof Blob) || !image.size || image.size > IMAGE_LIMIT || !IMAGE_TYPES.includes(image.type))
        throw new RecognitionError("图片须为 JPEG、PNG 或 WebP，且不超过 4 MiB");
      diagnostics.timings_ms.request_parse_ms = Math.round(performance.now() - startedAt);
      const result = await recognize(workspace, form, image, requestConfig, diagnostics, fetcher);
      diagnostics.timings_ms.api_total_ms = Math.round(performance.now() - startedAt);
      return json({ data: { ...result, request_id: requestId, diagnostics } }, 200);
    } catch (error) {
      if (diagnostics.phase === "request_parse") diagnostics.timings_ms.request_parse_ms = Math.round(performance.now() - startedAt);
      diagnostics.timings_ms.api_total_ms = Math.round(performance.now() - startedAt);
      const failure = error instanceof RecognitionError ? error :
        isTimeout(error) ? new RecognitionError("请求处理超时，请稍后重试", 408, "request_timeout", 2000) :
        new RecognitionError("匹配服务暂不可用，请稍后重试", 503, "recognition_unavailable");
      return json({ error: failure.message, ...(failure.code ? { code: failure.code } : {}), request_id: requestId,
        ...(failure.retryAfterMs === undefined ? {} : { retry_after_ms: failure.retryAfterMs }), diagnostics }, failure.status,
      failure.retryAfterMs === undefined ? {} : { "Retry-After": String(Math.ceil(failure.retryAfterMs / 1000)) });
    }
  };
}
