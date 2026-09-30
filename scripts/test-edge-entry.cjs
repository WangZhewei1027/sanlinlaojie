/* eslint-disable @typescript-eslint/no-require-imports -- Execute the real Deno entrypoint with VM runtime substitutes. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../supabase/functions/recognize-anchor/index.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modelUrl = "https://model.test/api/predict/sage_gpu/embed";
function start(endpoint = "https://model.test/api/predict/sage_gpu/") {
  const calls = [], clients = [], served = [];
  const client = { transport: "fake-eas-client" };
  const handler = async () => new Response("handler");
  let configured;
  const env = { SUPABASE_URL: "https://database.test", SUPABASE_SERVICE_ROLE_KEY: "fake-database-key",
    SAGE_EAS_ENDPOINT: endpoint, SAGE_EAS_TOKEN: "fake-eas-key", SAGE_MATCH_THRESHOLD: "0.3",
    SAGE_MATCH_MARGIN: "0.03", SB_REGION: "ap-northeast-1" };
  const sandbox = {
    exports: {}, URL, Request,
    require(name) {
      assert.equal(name, "./handler.ts");
      return { createRecognitionHandler(config, fetcher) { configured = { config, fetcher }; return handler; } };
    },
    Deno: {
      env: { get: (key) => env[key] },
      createHttpClient(options) { clients.push(options); return client; },
      serve(callback) { served.push(callback); },
    },
    fetch: async (input, init) => { calls.push({ input, init }); return new Response("upstream"); },
  };
  vm.runInNewContext(compiled, sandbox, { filename });
  return { calls, clients, served, configured, client, handler };
}
test("Deno entrypoint constructs one EAS client and serves the configured recognition handler", () => {
  const f = start();
  assert.equal(f.clients.length, 1);
  assert.deepEqual({ ...f.clients[0] }, { http1: true, http2: false, poolMaxIdlePerHost: 0 });
  assert.deepEqual(f.served, [f.handler]);
  assert.equal(f.configured.config.modelEndpoint, "https://model.test/api/predict/sage_gpu/");
  assert.equal(f.configured.config.supabaseUrl, "https://database.test");
  assert.equal(f.configured.config.edgeRegion, "ap-northeast-1");
  assert.equal(f.calls.length, 0, "initialization never warms or queries the model");
});
test("only the exact EAS embed URL receives its dedicated client; inputs, headers and AbortSignal survive", async () => {
  const f = start();
  const controller = new AbortController();
  const headers = new Headers({ Authorization: "fake-eas-key", "X-Recognition-Request-Id": "entry-test" });
  const body = new FormData(); body.set("image", new Blob(["image"], { type: "image/jpeg" }), "q.jpg");
  const init = { method: "POST", headers, body, signal: controller.signal, redirect: "error" };
  for (const input of [modelUrl, new URL(modelUrl), new Request(modelUrl, { method: "POST" })]) {
    const response = await f.configured.fetcher(input, init);
    assert.equal(await response.text(), "upstream");
    const forwarded = f.calls.at(-1);
    assert.equal(forwarded.input, input);
    assert.equal(forwarded.init.client, f.client);
    assert.equal(forwarded.init.signal, controller.signal);
    assert.equal(forwarded.init.headers, headers);
    assert.equal(forwarded.init.body, body);
    assert.equal(forwarded.init.method, "POST");
    assert.equal(forwarded.init.redirect, "error");
    assert.equal(Object.hasOwn(init, "client"), false, "routing does not mutate the caller's init");
  }
  controller.abort();
  assert.equal(f.calls.at(-1).init.signal.aborted, true);
});
test("database requests and similar model URLs retain default fetch and their original init", async () => {
  const f = start();
  const controller = new AbortController();
  const init = { method: "POST", signal: controller.signal, headers: { apikey: "fake-database-key" }, body: "{}" };
  const urls = [
    "https://database.test/rest/v1/rpc/prepare_anchor_match_context",
    "https://database.test/rest/v1/rpc/finalize_anchor_match",
    "https://model.test/api/predict/sage_gpu/health",
    `${modelUrl}?extra=1`, `${modelUrl}/`, `${modelUrl}-extra`,
    "https://model.test.evil/api/predict/sage_gpu/embed",
  ];
  for (const url of urls) {
    for (const input of [url, new URL(url), new Request(url)]) {
      await f.configured.fetcher(input, init);
      const forwarded = f.calls.at(-1);
      assert.equal(forwarded.input, input);
      assert.equal(forwarded.init, init);
      assert.equal(forwarded.init.client, undefined);
    }
  }
  await f.configured.fetcher(urls[0]);
  assert.equal(f.calls.at(-1).init, undefined);
});
test("missing model endpoint cannot redirect unrelated requests to the custom transport", async () => {
  const f = start(null);
  await f.configured.fetcher(modelUrl);
  assert.equal(f.calls.at(-1).init, undefined);
  const normal = start("https://model.test/api/predict/sage_gpu");
  await normal.configured.fetcher(modelUrl);
  assert.equal(normal.calls.at(-1).init.client, normal.client);
});
