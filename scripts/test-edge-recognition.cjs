/* eslint-disable @typescript-eslint/no-require-imports -- Tests execute the real Deno modules with deterministic Web API fakes in Node. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../supabase/functions/recognize-anchor");
const cache = new Map();
function load(name) {
  const filename = path.join(root, name);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(root);
  const standard = mod.require.bind(mod);
  mod.require = (requested) => requested.startsWith(".") ? load(requested) : standard(requested);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const { createRecognitionHandler } = load("handler.ts");
const { safeRequestId, parseGps } = load("protocol.ts");
const workspace = "11111111-1111-4111-8111-111111111111";
const anchor = "22222222-2222-4222-8222-222222222222";
const queryUrl = `https://database.test/functions/v1/recognize-anchor?workspace_id=${workspace}`;
const config = { supabaseUrl: "https://database.test", serviceRoleKey: "private-database-key",
  modelEndpoint: "https://model.test", modelToken: "private-model-key", threshold: "0.8", margin: "0.03", edgeRegion: "ap-south-1" };
function vector(x = 1, y = 0) { const v = Array(8448).fill(0); v[0] = x; v[1] = y; return v; }
function form(overrides = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ latitude: 31, longitude: 121, accuracy: 10,
    gps_timestamp: Date.now(), coordinate_system: "wgs84", ...overrides })) body.set(key, String(value));
  body.set("image", new Blob(["jpeg"], { type: "image/jpeg" }), "image.jpg");
  return body;
}
function fixture(options = {}) {
  const candidates = options.candidates ?? [{ id: anchor, name: "Point", file_url: "private-reference-url",
    distance_meters: 12, reference_image_url: "private-reference-url", reference_status: "ready", embedding_version: "v1", embedding: vector() }];
  const snapshot = [{ id: anchor, generation: "private-reference-generation" }];
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    options.onFetch?.(String(url), init);
    if (String(url).endsWith("/prepare_anchor_match_context")) {
      if (options.contextResponse) return options.contextResponse();
      return Response.json({ allowed: options.allowed !== false, candidates, reference_snapshot: snapshot });
    }
    if (String(url).endsWith("/finalize_anchor_match")) {
      assert.deepEqual(JSON.parse(init.body).p_reference_snapshot, snapshot);
      return Response.json({ unchanged: !options.changed, assets: [{ id: "child", anchor_id: anchor }] });
    }
    if (options.modelThrows) throw options.modelThrows;
    if (options.modelResponse) return options.modelResponse();
    return new Response(JSON.stringify(options.modelBody ?? {
      model: "sage_vitb", embedding_version: "v1", embedding: vector(), device: "cuda",
      queue_wait_ms: 2, decode_ms: 3, inference_ms: 90, service_total_ms: 98,
      request_id: init.headers["X-Recognition-Request-Id"],
    }), { status: options.modelStatus ?? 200, headers: { "Content-Type": "application/json" } });
  };
  const handler = createRecognitionHandler({ ...config, ...options.config }, fetcher);
  return { calls, candidates, handler, run: (overrides = {}, headers = { "X-Recognition-Request-Id": "client-1" }) =>
    handler(new Request(queryUrl, { method: "POST", body: form(overrides), headers })) };
}
test("public edge request makes two scoped RPCs and one model call; propagates request ID and real telemetry", async () => {
  const f = fixture();
  const response = await f.run();
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.matched, true);
  assert.equal(data.assets[0].id, "child");
  assert.equal(data.request_id, "client-1");
  assert.equal(response.headers.get("X-Recognition-Request-Id"), "client-1");
  assert.equal(data.diagnostics.model_device, "cuda");
  assert.equal(data.diagnostics.edge_region, "ap-south-1");
  assert.equal(data.diagnostics.upstream_status, 200);
  assert.equal(f.calls.length, 3);
  const [before, model, after] = f.calls;
  assert.match(before.url, /prepare_anchor_match_context$/);
  assert.equal(JSON.parse(before.init.body).p_workspace_id, workspace);
  assert.equal(JSON.parse(before.init.body).p_radius, 75);
  assert.equal(before.init.headers.Authorization, "Bearer private-database-key");
  assert.equal(model.init.headers.Authorization, "private-model-key");
  assert.equal(model.init.headers["X-Recognition-Request-Id"], "client-1");
  assert.match(after.url, /finalize_anchor_match$/);
  assert.equal(JSON.parse(after.init.body).p_anchor_id, anchor);
  const t = data.diagnostics.timings_ms;
  for (const key of ["database_context_ms", "database_finalize_ms", "model_request_ms", "api_total_ms"]) assert.ok(t[key] >= 0);
  assert.equal(t.model_inference_ms, 90);
  assert.equal(t.model_queue_ms, 2);
  assert.equal(t.model_decode_ms, 3);
  assert.equal(t.model_service_total_ms, 98);
  assert.equal(t.gps_query_ms, undefined);
  assert.equal(t.reference_read_ms, undefined);
  assert.doesNotMatch(JSON.stringify(data.diagnostics), /private-|embedding|reference_snapshot/);
});
test("no candidates or any unready competitor skips model work; no reference rebuilding", async () => {
  for (const options of [{ candidates: [] }, { ready: false }]) {
    const f = fixture(options);
    if (options.ready === false) f.candidates.push({ ...f.candidates[0], id: "another", reference_status: "pending" });
    const { data } = await (await f.run()).json();
    assert.equal(data.reason, options.candidates ? "no_nearby_anchor" : "reference_not_ready");
    assert.equal(f.calls.length, 1);
    assert.equal(data.diagnostics.timings_ms.model_request_ms, undefined);
  }
});
test("candidate cap, workspace rate limit and invalid GPS reject before inference", async () => {
  const tooMany = fixture();
  tooMany.candidates.push(...Array(200).fill(tooMany.candidates[0]));
  assert.equal((await tooMany.run()).status, 422);
  assert.equal(tooMany.calls.length, 1);
  const limited = fixture({ allowed: false });
  const response = await limited.run();
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.code, "workspace_rate_limited");
  assert.equal(body.retry_after_ms, 60000);
  assert.equal(body.diagnostics.phase, "database_context");
  assert.ok(body.diagnostics.timings_ms.database_context_ms >= 0);
  assert.equal(limited.calls.length, 1);
  for (const invalid of [{ accuracy: 101 }, { gps_timestamp: Date.now() - 60000 }, { coordinate_system: "gcj02" }]) {
    const f = fixture(); assert.equal((await f.run(invalid)).status, 400); assert.equal(f.calls.length, 0);
  }
  assert.equal(parseGps(form({ accuracy: 60 })).radius, 120);
});
test("threshold, margin, version and final snapshot enforce fail-closed results", async () => {
  const low = fixture(); low.candidates[0].embedding = vector(0.7, Math.sqrt(1 - 0.49));
  assert.equal((await (await low.run()).json()).data.reason, "below_threshold");
  assert.equal(low.calls.length, 2);
  const ambiguous = fixture(); ambiguous.candidates.push({ ...ambiguous.candidates[0], id: "other" });
  assert.equal((await (await ambiguous.run()).json()).data.reason, "ambiguous");
  const changed = fixture({ changed: true });
  const result = (await (await changed.run()).json()).data;
  assert.equal(result.reason, "reference_changed"); assert.deepEqual(result.assets, []);
  const version = fixture(); version.candidates[0].embedding_version = "old";
  assert.equal((await (await version.run()).json()).data.reason, "model_version_mismatch");
  assert.equal(version.calls.length, 2);
});
test("model errors retain bounded public telemetry and statuses, never raw body or secrets", async () => {
  for (const status of [429, 403, 500, 503]) {
    const f = fixture({ modelStatus: status, modelBody: { code: "model_queue_full", device: "cuda:0",
      request_id: "model-req", queue_wait_ms: 10, decode_ms: NaN, inference_ms: -1,
      service_total_ms: 12, message: "private-model-key private-reference-url" } });
    const response = await f.run(); const body = await response.json();
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.equal(body.code, status === 429 ? "model_queue_full" : "model_unavailable");
    assert.equal(body.diagnostics.upstream_status, status);
    assert.equal(body.diagnostics.model_code, "model_queue_full");
    assert.equal(body.diagnostics.model_device, "cuda:0");
    assert.equal(body.diagnostics.upstream_request_id, "model-req");
    assert.equal(body.diagnostics.timings_ms.model_queue_ms, 10);
    assert.equal(body.diagnostics.timings_ms.model_inference_ms, undefined);
    assert.ok(body.diagnostics.timings_ms.model_request_ms >= 0);
    assert.ok(body.diagnostics.timings_ms.api_total_ms >= 0);
    assert.equal(body.request_id, "client-1");
    assert.doesNotMatch(JSON.stringify(body), /private-/);
    assert.equal(f.calls.length, 2, "errors never trigger hidden automatic retries");
    if (status === 429) { assert.equal(body.retry_after_ms, 1000); assert.equal(response.headers.get("Retry-After"), "1"); }
  }
});
test("model timeout and network failure are distinct from an HTTP upstream refusal", async () => {
  for (const [failure, status, code] of [[new DOMException("private-host", "TimeoutError"), 504, "model_timeout"],
    [new TypeError("private-host"), 502, "model_network_error"]]) {
    const f = fixture({ modelThrows: failure }); const response = await f.run(); const body = await response.json();
    assert.equal(response.status, status); assert.equal(body.code, code);
    assert.equal(body.diagnostics.upstream_status, undefined);
    assert.ok(body.diagnostics.timings_ms.model_request_ms >= 0);
    assert.doesNotMatch(JSON.stringify(body), /private-host/);
  }
});
test("request ID rejects arbitrary header contents and CORS preflight requires no credentials", async () => {
  for (const id of ["", "a".repeat(65), "x:y", "x/y", "☃"]) assert.equal(safeRequestId(id), undefined);
  assert.equal(safeRequestId("mu-client_1.req"), "mu-client_1.req");
  const f = fixture();
  const rejected = await f.run({}, { "X-Recognition-Request-Id": "bad:id" });
  assert.equal(rejected.status, 400); assert.notEqual(rejected.headers.get("X-Recognition-Request-Id"), "bad:id");
  assert.equal(f.calls.length, 0);
  const preflight = await f.handler(new Request(queryUrl, { method: "OPTIONS" }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /x-region/);
  assert.equal(f.calls.length, 0);
});
test("malformed and oversized uploads return diagnostics without fetching external services", async () => {
  const f = fixture();
  for (const request of [new Request(queryUrl, { method: "POST", body: "bad multipart" }),
    new Request(queryUrl, { method: "POST", body: new Uint8Array(4 * 1024 * 1024 + 65537) })]) {
    const response = await f.handler(request); const body = await response.json();
    assert.ok([400, 413].includes(response.status));
    assert.equal(body.diagnostics.phase, "request_parse");
    assert.ok(body.diagnostics.timings_ms.request_parse_ms >= 0);
    assert.ok(body.request_id);
  }
  assert.equal(f.calls.length, 0);
});
test("missing calibration never silently changes threshold", async () => {
  const f = fixture({ config: { threshold: undefined } }); const response = await f.run();
  assert.equal(response.status, 503); assert.equal((await response.json()).code, "threshold_unconfigured");
  assert.equal(f.calls.length, 0);
});

test("queue codes are preserved, unknown model codes are hidden, and legacy EAS busy stays compatible", async () => {
  for (const [modelCode, status, code] of [["model_queue_timeout", 429, "model_queue_timeout"],
    ["private-model-key", 429, "model_busy"], ["model_inference_error", 500, "model_unavailable"],
    ["invalid_request", 422, "model_unavailable"]]) {
    const f = fixture({ modelStatus: status, modelBody: { code: modelCode, request_id: "bad/id" } });
    const body = await (await f.run()).json();
    assert.equal(body.code, code);
    assert.equal(body.diagnostics.model_code, modelCode === "private-model-key" ? undefined : modelCode);
    assert.equal(body.diagnostics.upstream_request_id, undefined);
    assert.doesNotMatch(JSON.stringify(body), /private-model-key/);
  }
});
test("invalid or oversized model responses are bounded and response-body timeouts retain correlation", async () => {
  const malformed = fixture({ modelResponse: () => new Response("not-json", {
    headers: { "X-Recognition-Request-Id": "upstream-1" },
  }) });
  let response = await malformed.run(); let body = await response.json();
  assert.equal(response.status, 502); assert.equal(body.code, "model_invalid_response");
  assert.equal(body.diagnostics.upstream_request_id, "upstream-1");
  const timedOut = fixture({ modelResponse: () => new Response(new ReadableStream({
    start(controller) { controller.error(new DOMException("private-url", "AbortError")); },
  }), { headers: { "X-Recognition-Request-Id": "upstream-2" } }) });
  response = await timedOut.run(); body = await response.json();
  assert.equal(response.status, 504); assert.equal(body.code, "model_timeout");
  assert.equal(body.diagnostics.upstream_request_id, "upstream-2");
  assert.ok(body.diagnostics.timings_ms.model_request_ms >= 0);
  assert.doesNotMatch(JSON.stringify(body), /private-url/);
  let cancelled = false;
  const huge = fixture({ modelResponse: () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(16385)); },
    cancel() { cancelled = true; },
  }), { status: 429 }) });
  response = await huge.run(); body = await response.json();
  assert.equal(response.status, 429); assert.equal(body.code, "model_busy");
  assert.equal(cancelled, true);
});
test("invalid model vectors and protocols cannot reach asset finalization", async () => {
  for (const modelBody of [{ model: "unknown" }, { model: "sage_vitb", embedding_version: "v1", embedding: [] },
    { model: "sage_vitb", embedding_version: "v1", embedding: Array(8448).fill(0) }]) {
    const f = fixture({ modelBody }); const response = await f.run(); const body = await response.json();
    assert.equal(response.status, 502); assert.equal(body.code, "model_invalid_response");
    assert.equal(f.calls.length, 2);
    assert.equal(body.diagnostics.timings_ms.database_finalize_ms, undefined);
  }
});

test("one 15-second deadline is consumed across RPC and model stages, with 6s/12s caps", async () => {
  const originalNow = Object.getOwnPropertyDescriptor(performance, "now");
  const originalSetTimeout = global.setTimeout;
  let now = 1000;
  const delays = [];
  Object.defineProperty(performance, "now", { configurable: true, value: () => now });
  global.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    return originalSetTimeout(callback, delay, ...args);
  };
  try {
    const f = fixture({ onFetch: (url) => {
      if (url.endsWith("/prepare_anchor_match_context")) now += 5000;
      if (url.endsWith("/embed")) now += 8000;
    } });
    const response = await f.run(); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.data.matched, true);
    assert.deepEqual(delays, [15000, 6000, 10000, 2000]);
    assert.equal(body.data.diagnostics.timings_ms.api_total_ms, 13000);
    assert.doesNotMatch(JSON.stringify(body), /deadlineAtMs/);
    delays.length = 0;
    const fast = fixture(); await fast.run();
    assert.deepEqual(delays, [15000, 6000, 12000, 6000]);
  } finally {
    global.setTimeout = originalSetTimeout;
    if (originalNow) Object.defineProperty(performance, "now", originalNow);
    else delete performance.now;
  }
});
test("expired total budget never starts another external call", async () => {
  const f = fixture({ config: { deadlineAtMs: performance.now() - 1 } });
  const response = await f.run(); const body = await response.json();
  assert.equal(response.status, 408); assert.equal(body.code, "request_timeout");
  assert.equal(f.calls.length, 0); assert.equal(body.diagnostics.phase, "request_parse");
  assert.ok(body.diagnostics.timings_ms.api_total_ms >= 0);
});
test("a stalled public upload is cancelled within its short request budget", async () => {
  let cancelled = false;
  const f = fixture({ config: { deadlineAtMs: performance.now() + 30 } });
  const response = await f.handler(new Request(queryUrl, { method: "POST", duplex: "half",
    headers: { "Content-Type": "multipart/form-data; boundary=test", "X-Recognition-Request-Id": "upload-timeout" },
    body: new ReadableStream({ cancel() { cancelled = true; } }),
  }));
  const body = await response.json();
  assert.equal(response.status, 408); assert.equal(body.code, "request_timeout");
  assert.equal(cancelled, true); assert.equal(f.calls.length, 0);
  assert.equal(body.request_id, "upload-timeout");
  assert.ok(body.diagnostics.timings_ms.request_parse_ms >= 0);
});
test("database fetch and database response reads cannot outlive remaining request budget", async () => {
  for (const bodyStalls of [false, true]) {
    let cancelled = false;
    const f = fixture({ config: { deadlineAtMs: performance.now() + 30 }, contextResponse: () => bodyStalls
      ? new Response(new ReadableStream({ cancel() { cancelled = true; } }))
      : new Promise(() => {}) });
    const response = await f.run(); const body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.code, "database_unavailable");
    assert.equal(body.diagnostics.phase, "database_context");
    assert.ok(body.diagnostics.timings_ms.database_context_ms >= 0);
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].init.signal.aborted, true);
    if (bodyStalls) assert.equal(cancelled, true);
  }
});
test("model fetch and model response reads share the remaining budget and retain model_timeout", async () => {
  for (const bodyStalls of [false, true]) {
    let cancelled = false;
    const f = fixture({ config: { deadlineAtMs: performance.now() + 30 }, modelResponse: () => bodyStalls
      ? new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
        headers: { "X-Recognition-Request-Id": "stalled-model" },
      }) : new Promise(() => {}) });
    const response = await f.run(); const body = await response.json();
    assert.equal(response.status, 504); assert.equal(body.code, "model_timeout");
    assert.equal(body.diagnostics.phase, "model");
    assert.ok(body.diagnostics.timings_ms.model_request_ms >= 0);
    assert.ok(body.diagnostics.timings_ms.matching_total_ms >= 0);
    assert.equal(f.calls.length, 2); assert.equal(f.calls[1].init.signal.aborted, true);
    if (bodyStalls) { assert.equal(cancelled, true); assert.equal(body.diagnostics.upstream_request_id, "stalled-model"); }
    assert.doesNotMatch(JSON.stringify(body), /deadlineAtMs|private-/);
  }
});

test("buffered model multipart preserves every image byte and consistent boundary/length with the active signal", async () => {
  const expected = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46,
    0, 13, 10, 0x22, 0x5c, 0xe4, 0xb8, 0xad, 0x80, 0xfe, 0xff, 0xd9]);
  const f = fixture();
  const incoming = form();
  incoming.set("image", new Blob([expected], { type: "image/jpeg" }), "source.jpg");
  const response = await f.handler(new Request(queryUrl, { method: "POST", body: incoming,
    headers: { "X-Recognition-Request-Id": "byte-preservation" },
  }));
  assert.equal(response.status, 200);
  const { init } = f.calls.find((call) => call.url === "https://model.test/embed");
  assert.ok(init.body instanceof ArrayBuffer);
  const headers = new Headers(init.headers);
  const type = headers.get("Content-Type");
  const boundary = /^multipart\/form-data;\s*boundary=(.+)$/.exec(type)?.[1];
  assert.ok(boundary);
  assert.equal(Number(headers.get("Content-Length")), init.body.byteLength);
  const prefix = new TextEncoder().encode(`--${boundary}\r\n`);
  assert.deepEqual(new Uint8Array(init.body).slice(0, prefix.length), prefix);
  const uploaded = await new Response(init.body, { headers }).formData();
  assert.deepEqual(Array.from(uploaded.keys()), ["image"]);
  const image = uploaded.get("image");
  assert.equal(image.type, "image/jpeg");
  assert.equal(image.name, "frame.jpg");
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), expected);
  assert.equal(headers.get("X-Recognition-Request-Id"), "byte-preservation");
  assert.equal(headers.get("Authorization"), "private-model-key");
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.signal.aborted, false);
  assert.equal(init.redirect, "error");
});
