export const IMAGE_LIMIT = 4 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DIMENSION = 8448;
export const REQUEST_BUDGET_MS = 15000;
export interface Diagnostics {
  timings_ms: Record<string, number>;
  phase: string;
  request_id: string;
  edge_region?: string;
  upstream_status?: number;
  upstream_request_id?: string;
  model_code?: string;
  model_device?: string;
  candidate_count?: number;
  ready_reference_count?: number;
  threshold?: number;
  required_margin?: number;
  best_similarity?: number | null;
  second_similarity?: number | null;
  score_gap?: number | null;
  best_distance_meters?: number | null;
}
export interface Config {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  modelEndpoint?: string;
  modelToken?: string;
  threshold?: string;
  margin?: string;
  edgeRegion?: string;
  /** Internal monotonic deadline, never accepted from HTTP or emitted in diagnostics. */
  deadlineAtMs?: number;
}
export class RecognitionError extends Error {
  constructor(message: string, public status = 400, public code?: string,
    public retryAfterMs?: number) { super(message); }
}
export function safeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
    ? value : undefined;
}
export function finiteNumber(value: unknown, min: number, max: number, name: string): number {
  if ((typeof value !== "number" && typeof value !== "string") ||
      (typeof value === "string" && !value.trim())) throw new RecognitionError(`Invalid ${name}`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max)
    throw new RecognitionError(`Invalid ${name}`);
  return result;
}
export function workspaceId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new RecognitionError("Invalid workspace_id");
  return value;
}
export function parseGps(form: FormData, now = Date.now()) {
  if (form.get("coordinate_system") !== "wgs84") throw new RecognitionError("coordinate_system must be wgs84");
  const latitude = finiteNumber(form.get("latitude"), -90, 90, "latitude");
  const longitude = finiteNumber(form.get("longitude"), -180, 180, "longitude");
  const accuracy = finiteNumber(form.get("accuracy"), 0, 100, "accuracy (0–100 metres)");
  finiteNumber(form.get("gps_timestamp"), now - 30000, now + 5000, "gps_timestamp (fresh Unix milliseconds)");
  return { latitude, longitude, radius: Math.min(200, Math.max(75, accuracy * 2)) };
}
export function normalized(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== DIMENSION ||
      value.some((v) => typeof v !== "number" || !Number.isFinite(v)))
    throw new RecognitionError("模型特征无效", 502, "model_invalid_response");
  const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
  if (!Number.isFinite(norm) || norm < 1e-8)
    throw new RecognitionError("模型特征无效", 502, "model_invalid_response");
  return value.map((n) => n / norm);
}
export function cosine(a: number[], b: number[]): number {
  return Math.max(-1, Math.min(1, a.reduce((sum, n, i) => sum + n * b[i], 0)));
}
/** Stream limit also covers chunked uploads and gateway responses without Content-Length. */
export async function readBounded(body: ReadableStream<Uint8Array> | null, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (!body) throw new RecognitionError("缺少请求内容");
  signal?.throwIfAborted();
  const reader = body.getReader();
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RecognitionError("上传内容超过大小限制", 413);
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return joined;
}
export async function timed<T>(diagnostics: Diagnostics, key: string, action: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try { return await action(); }
  finally { diagnostics.timings_ms[key] = Math.round(performance.now() - start); }
}

/** Fetch + response consumption share one cap, itself bounded by the request deadline. */
export async function withBudget<T>(config: Config, capMs: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  const remaining = Math.min(capMs, (config.deadlineAtMs ?? Infinity) - startedAt);
  if (remaining <= 0) throw new DOMException("Request time budget exhausted", "TimeoutError");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException("Request time budget exhausted", "TimeoutError");
      reject(error);
      controller.abort(error);
    }, Math.ceil(remaining));
  });
  try {
    const result = await Promise.race([operation(controller.signal), expired]);
    if (performance.now() >= startedAt + remaining) {
      const error = new DOMException("Request time budget exhausted", "TimeoutError");
      controller.abort(error);
      throw error;
    }
    return result;
  }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
