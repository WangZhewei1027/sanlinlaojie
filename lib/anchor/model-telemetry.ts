/**
 * Bounded, typed telemetry from the SAGE model service (PAI-EAS), surfaced in
 * recognition diagnostics so a slow round can be split into network vs.
 * queueing vs. inference. Only whitelisted codes, finite durations, a device
 * label and a strictly formatted request id cross the public boundary — never
 * raw error bodies. Same rules as the former Supabase Edge Function.
 */

const PUBLIC_CODES = new Set([
  "model_queue_full",
  "model_queue_timeout",
  "model_inference_error",
  "invalid_image",
  "image_too_large",
  "unsupported_image",
  "model_unavailable",
  "invalid_request_id",
  "invalid_request",
]);

const TIMING_FIELDS = {
  queue_wait_ms: "model_queue_ms",
  decode_ms: "model_decode_ms",
  inference_ms: "model_inference_ms",
  service_total_ms: "model_service_total_ms",
} as const;

export const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface ModelTelemetry {
  upstream_status?: number;
  upstream_request_id?: string;
  model_code?: string;
  model_device?: string;
  timings_ms: Partial<Record<(typeof TIMING_FIELDS)[keyof typeof TIMING_FIELDS], number>>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeId(value: unknown): string | undefined {
  return typeof value === "string" && REQUEST_ID_RE.test(value) ? value : undefined;
}

/** Merge what the model reported (JSON body and/or headers) into `telemetry`. */
export function readModelTelemetry(
  value: unknown,
  headers: Headers,
  telemetry: ModelTelemetry,
): void {
  const root = record(value);
  const body = { ...record(root.detail), ...root };
  const id =
    safeId(body.request_id) ||
    safeId(headers.get("X-Recognition-Request-Id")) ||
    safeId(headers.get("X-Request-Id")) ||
    safeId(headers.get("X-Acs-Request-Id"));
  if (id) telemetry.upstream_request_id = id;
  if (typeof body.code === "string" && PUBLIC_CODES.has(body.code))
    telemetry.model_code = body.code;
  if (typeof body.device === "string" && /^(cpu|cuda(?::[0-9]{1,2})?)$/.test(body.device))
    telemetry.model_device = body.device;
  for (const [source, target] of Object.entries(TIMING_FIELDS)) {
    const duration = body[source];
    if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0 && duration <= 3_600_000)
      telemetry.timings_ms[target] = duration;
  }
}
