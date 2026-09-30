import { Config, Diagnostics, RecognitionError, normalized, readBounded, safeRequestId, withBudget, isTimeout } from "./protocol.ts";

const PUBLIC_CODES = new Set([
  "model_queue_full", "model_queue_timeout", "model_inference_error", "invalid_image",
  "image_too_large", "unsupported_image", "model_unavailable", "invalid_request_id", "invalid_request",
]);
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Only bounded, typed telemetry crosses the public boundary; never raw error messages. */
function readTelemetry(value: unknown, headers: Headers, diagnostics: Diagnostics) {
  const root = record(value);
  const body = { ...record(root.detail), ...root };
  const id = safeRequestId(body.request_id) || safeRequestId(headers.get("X-Recognition-Request-Id")) ||
    safeRequestId(headers.get("X-Request-Id")) || safeRequestId(headers.get("X-Acs-Request-Id"));
  if (id) diagnostics.upstream_request_id = id;
  if (typeof body.code === "string" && PUBLIC_CODES.has(body.code)) diagnostics.model_code = body.code;
  if (typeof body.device === "string" && /^(cpu|cuda(?::[0-9]{1,2})?)$/.test(body.device))
    diagnostics.model_device = body.device;
  for (const [source, target] of Object.entries({ queue_wait_ms: "model_queue_ms", decode_ms: "model_decode_ms",
    inference_ms: "model_inference_ms", service_total_ms: "model_service_total_ms" })) {
    const duration = body[source];
    if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0 && duration <= 3600000)
      diagnostics.timings_ms[target] = duration;
  }
}
export async function embedImage(image: Blob, config: Config, diagnostics: Diagnostics, fetcher: typeof fetch) {
  if (!config.modelEndpoint || !config.modelToken)
    throw new RecognitionError("匹配服务尚未配置", 503, "model_unconfigured");
  const form = new FormData();
  form.set("image", image, "frame.jpg");
  try {
    return await withBudget(config, 12000, async (signal) => {
      // Serialize the bounded multipart body so EAS receives a known byte length.
      const multipart = new Response(form);
      const payload = await multipart.arrayBuffer();
      if (signal.aborted) throw signal.reason;
      const response = await fetcher(`${config.modelEndpoint!.replace(/\/$/, "")}/embed`, {
        method: "POST", headers: { Authorization: config.modelToken!, "X-Recognition-Request-Id": diagnostics.request_id,
          "Content-Type": multipart.headers.get("Content-Type")!, "Content-Length": String(payload.byteLength) },
        body: payload, signal, redirect: "error",
      });
      diagnostics.upstream_status = response.status;
      readTelemetry({}, response.headers, diagnostics);
      // Fetch and bounded response consumption use the same remaining budget.
      let body: Record<string, unknown> = {};
      try {
        const bytes = await readBounded(response.body, response.ok ? 1024 * 1024 : 16 * 1024, signal);
        body = record(JSON.parse(new TextDecoder().decode(bytes)));
      } catch (error) {
        if (isTimeout(error)) throw error;
        if (response.ok) throw new RecognitionError("模型返回内容无效", 502, "model_invalid_response");
      }
      readTelemetry(body, response.headers, diagnostics);
      if (!response.ok) {
        if (response.status === 429) {
          const code = diagnostics.model_code === "model_queue_full" || diagnostics.model_code === "model_queue_timeout"
            ? diagnostics.model_code : "model_busy";
          throw new RecognitionError("匹配服务繁忙，请稍后重试", 429, code, 1000);
        }
        throw new RecognitionError("匹配服务暂不可用", 502, "model_unavailable", 2000);
      }
      if (body.model !== "sage_vitb" || typeof body.embedding_version !== "string" ||
          !body.embedding_version || body.embedding_version.length > 300)
        throw new RecognitionError("模型返回版本无效", 502, "model_invalid_response");
      return { embedding: normalized(body.embedding), version: body.embedding_version };
    });
  } catch (error) {
    if (error instanceof RecognitionError) throw error;
    if (isTimeout(error)) throw new RecognitionError("模型响应超时，请稍后重试", 504, "model_timeout", 2000);
    throw new RecognitionError("无法连接匹配服务，请稍后重试", 502, "model_network_error", 2000);
  }
}
