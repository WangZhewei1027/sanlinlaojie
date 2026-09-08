/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness loads real TypeScript modules in memory. */
// Run with: node --test scripts/test-anchor-matching.cjs
// Transpile the real modules in memory; external DB/model calls are deterministic fakes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function loader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const standard = mod.require.bind(mod);
    mod.require = (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
      if (name.startsWith("."))
        return load(
          path.relative(root, path.resolve(path.dirname(filename), name)) +
            ".ts",
        );
      return standard(name);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
    return mod.exports;
  }
  return load;
}
const pure = loader()("lib/anchor-matching.ts");
const workspace = "11111111-1111-4111-8111-111111111111";
function vector(x = 1, y = 0) {
  const v = Array(8448).fill(0);
  v[0] = x;
  v[1] = y;
  return v;
}
function gpsForm() {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    latitude: 31.1,
    longitude: 121.5,
    accuracy: 20,
    gps_timestamp: Date.now(),
    coordinate_system: "wgs84",
  }))
    f.set(k, String(v));
  return f;
}
test("GPS validates units, freshness, finite ranges and coordinate system", () => {
  assert.equal(pure.parseGps(gpsForm()).radius, 75);
  for (const [field, value] of [
    ["accuracy", "101"],
    ["gps_timestamp", String(Date.now() - 60000)],
    ["coordinate_system", "gcj02"],
    ["latitude", "NaN"],
    ["longitude", ""],
    ["latitude", "91"],
  ]) {
    const form = gpsForm();
    form.set(field, value);
    assert.throws(() => pure.parseGps(form), pure.MatchingError);
  }
  assert.equal(pure.distanceMeters(31, 121, 31, 121), 0);
  assert.ok(Math.abs(pure.distanceMeters(0, 0, 0, 1) - 111195) < 2);
});
test("descriptors normalize and reject wrong dimensions, zero, NaN and strings", () => {
  assert.equal(pure.validateEmbedding(vector(2))[0], 1);
  for (const v of [[], Array(8448).fill(0), vector(NaN), vector("1")])
    assert.throws(() => pure.validateEmbedding(v));
});
test("low similarity and ambiguous near-equal scores never match", () => {
  assert.equal(
    pure.chooseMatch([{ id: "a", score: 0.5 }], 0.8, 0.03).reason,
    "below_threshold",
  );
  assert.equal(
    pure.chooseMatch(
      [
        { id: "a", score: 0.9 },
        { id: "b", score: 0.89 },
      ],
      0.8,
      0.03,
    ).reason,
    "ambiguous",
  );
  assert.equal(
    pure.chooseMatch(
      [
        { id: "a", score: 0.95 },
        { id: "b", score: 0.85 },
      ],
      0.8,
      0.03,
    ).match.id,
    "a",
  );
});
function recognitionFixture(options = {}) {
  const candidates = options.candidates ?? [
    {
      id: "a",
      name: "Point A",
      file_url: "https://storage.test/a.jpg",
      distance_meters: 12,
      metadata: {},
    },
  ];
  const features =
    options.features ??
    candidates.map((c) => ({
      anchor_id: c.id,
      image_url: c.file_url,
      status: "ready",
      embedding_version: "test-v1",
      embedding: vector(),
    }));
  let encodes = 0,
    rpcCount = 0;
  const filters = [];
  const admin = {
    rpc: async (name) => {
      if (name === "consume_anchor_match_request")
        return { data: options.allowed !== false, error: null };
      rpcCount++;
      return {
        data: rpcCount > 1 && options.changed ? [] : candidates,
        error: null,
      };
    },
    from: (_table) => {
      const q = {
        select: () => q,
        order: () => q,
        in: async () => ({ data: features, error: null }),
        eq: (k, v) => {
          filters.push([k, v]);
          return q;
        },
        neq: (k, v) => {
          filters.push([k, v]);
          return q;
        },
        contains: (k, v) => {
          filters.push([k, v]);
          return { data: [{ id: "child", anchor_id: "a" }], error: null };
        },
      };
      return q;
    },
  };
  const recognize = loader({
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/supabase/paginate": { fetchAllRows: async (factory) => factory() },
    "./embedding.server": {
      embedImage: async () => {
        encodes++;
        return { version: "test-v1", embedding: vector() };
      },
    },
  })("lib/anchor/recognize.server.ts").recognizeAnchor;
  process.env.SAGE_MATCH_THRESHOLD = "0.8";
  process.env.SAGE_MATCH_MARGIN = "0.03";
  return {
    run: () => recognize(workspace, gpsForm(), new Blob(["image"])),
    count: () => encodes,
    filters,
  };
}
test("no GPS candidate skips image inference", async () => {
  const f = recognitionFixture({ candidates: [] });
  assert.equal((await f.run()).reason, "no_nearby_anchor");
  assert.equal(f.count(), 0);
});
test("missing or replaced reference is not rebuilt during recognition", async () => {
  for (const features of [
    [],
    [{ anchor_id: "a", image_url: "old", status: "ready" }],
  ]) {
    const f = recognitionFixture({ features });
    assert.equal((await f.run()).reason, "reference_not_ready");
    assert.equal(f.count(), 0);
  }
});
test("model version mismatch returns no assets", async () => {
  const f = recognitionFixture({
    features: [
      {
        anchor_id: "a",
        image_url: "https://storage.test/a.jpg",
        status: "ready",
        embedding_version: "old",
        embedding: vector(),
      },
    ],
  });
  assert.deepEqual((await f.run()).assets, []);
});
test("confirmed match returns children scoped to matching point AND workspace", async () => {
  const f = recognitionFixture();
  const result = await f.run();
  assert.equal(result.matched, true);
  assert.equal(result.assets[0].id, "child");
  assert.equal(f.count(), 1);
  assert.deepEqual(f.filters, [
    ["anchor_id", "a"],
    ["file_type", "anchor"],
    ["workspace_id", [workspace]],
  ]);
});
test("reference deleted or moved during inference cannot return its assets", async () => {
  assert.equal(
    (await recognitionFixture({ changed: true }).run()).reason,
    "reference_changed",
  );
});
test("workspace rate limit stops inference", async () => {
  const f = recognitionFixture({ allowed: false });
  await assert.rejects(f.run(), (e) => e.status === 429);
  assert.equal(f.count(), 0);
});
test("uncalibrated service fails closed", async () => {
  const f = recognitionFixture();
  delete process.env.SAGE_MATCH_THRESHOLD;
  await assert.rejects(f.run(), (e) => e.status === 503);
});
test("reference download rejects off-origin, redirects via user URL, and non-assets paths", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://storage.test";
  const { referenceUrl } = loader({
    "@/lib/supabase/admin": { createAdminClient: () => ({}) },
  })("lib/anchor/embedding.server.ts");
  assert.equal(
    referenceUrl(
      "https://storage.test/storage/v1/object/public/assets/user/photo.jpg",
    ).hostname,
    "storage.test",
  );
  for (const url of [
    "http://127.0.0.1/x",
    "https://storage.test.evil/x",
    "https://storage.test/storage/v1/object/public/other/x",
    "https://storage.test/storage/v1/object/public/assets/",
    "https://x:y@storage.test/storage/v1/object/public/assets/x",
  ])
    assert.throws(() => referenceUrl(url));
});
test("public mini-program credential only works for explicitly enabled workspaces", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  process.env.ANCHOR_PUBLIC_WORKSPACE_IDS = workspace;
  const access = loader()("lib/anchor/access.server.ts");
  await access.authorizeRecognition(
    new Request("https://app.test", { headers: { apikey: "test-public-key" } }),
    workspace,
  );
  await assert.rejects(
    access.authorizeRecognition(
      new Request("https://app.test", {
        headers: { apikey: "test-public-key" },
      }),
      "other",
    ),
    (e) => e.status === 401,
  );
  await assert.rejects(
    access.authorizeRecognition(new Request("https://app.test"), workspace),
    (e) => e.status === 401,
  );
});
test("asset attachment rejects self, nested anchors and cross-workspace parent", async () => {
  const { validateAnchorLink } = loader()("lib/anchor/access.server.ts");
  const supa = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { file_type: "anchor", workspace_id: ["other"] },
          }),
        }),
      }),
    }),
  };
  for (const [id, type] of [
    [workspace, "anchor"],
    [workspace, "image"],
  ])
    await assert.rejects(
      validateAnchorLink(supa, id, type, [workspace], workspace),
    );
  await assert.rejects(
    validateAnchorLink(supa, workspace, "image", [workspace]),
  );
});
test("multipart API validates image, returns structured response, and bounds body", async () => {
  let count = 0;
  const { POST } = loader({
    "@/lib/anchor/access.server": { authorizeRecognition: async () => {} },
    "@/lib/anchor/recognize.server": {
      recognizeAnchor: async () => {
        count++;
        return { matched: false, assets: [] };
      },
    },
  })("app/api/miniapp/anchors/recognize/route.ts");
  const url = `https://app.test/api/miniapp/anchors/recognize?workspace_id=${workspace}`;
  const form = gpsForm();
  form.set("image", new Blob(["test"], { type: "image/jpeg" }), "q.jpg");
  const good = await POST(new Request(url, { method: "POST", body: form }));
  assert.equal(good.status, 200);
  assert.equal(count, 1);
  assert.equal(
    (await POST(new Request(url, { method: "POST", body: gpsForm() }))).status,
    400,
  );
  assert.equal(
    (
      await POST(
        new Request(url, {
          method: "POST",
          body: new Uint8Array(4 * 1024 * 1024 + 65537),
        }),
      )
    ).status,
    413,
  );
  assert.equal(count, 1);
});
test("late reference generation cannot begin for a replaced image", async () => {
  process.env.SAGE_EAS_ENDPOINT = "https://model.test";
  process.env.SAGE_EAS_TOKEN = "test-token";
  const { syncAnchorEmbedding } = loader({
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        rpc: async () => ({ data: false, error: null }),
      }),
    },
  })("lib/anchor/embedding.server.ts");
  await assert.rejects(
    syncAnchorEmbedding(
      workspace,
      "https://storage.test/storage/v1/object/public/assets/old.jpg",
    ),
    (e) => e.status === 409,
  );
});
test("reference generation checks its generation ID before publishing ready", async () => {
  const originalFetch = global.fetch;
  const filters = [];
  const updates = [];
  global.fetch = async (url) =>
    String(url).startsWith("https://model.test")
      ? new Response(
          JSON.stringify({
            model: "sage_vitb",
            embedding_version: "test-v1",
            embedding: vector(),
          }),
          { headers: { "content-type": "application/json" } },
        )
      : new Response("fake-jpeg", {
          headers: { "content-type": "image/jpeg" },
        });
  const q = {
    eq: (k, v) => {
      filters.push([k, v]);
      return q;
    },
    select: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const admin = {
    rpc: async () => ({ data: true, error: null }),
    from: () => ({
      update: (value) => {
        updates.push(value);
        return q;
      },
    }),
  };
  try {
    const { syncAnchorEmbedding } = loader({
      "@/lib/supabase/admin": { createAdminClient: () => admin },
    })("lib/anchor/embedding.server.ts");
    await assert.rejects(
      syncAnchorEmbedding(
        workspace,
        "https://storage.test/storage/v1/object/public/assets/photo.jpg",
      ),
      (e) => e.status === 409,
    );
    assert.ok(
      filters.some(([k, v]) => k === "generation" && /^[a-f0-9-]{36}$/.test(v)),
    );
    assert.equal(updates[0].embedding.length, 8448);
    assert.equal(updates[1].status, "failed");
  } finally {
    global.fetch = originalFetch;
  }
});
