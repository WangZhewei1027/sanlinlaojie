/** Per-request QR versions and backend cache regression; no WeChat/OSS calls. */
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";

async function main() {
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://qr-test.invalid";
  process.env.WECHAT_APPID = "test-app";
  process.env.WECHAT_APPSECRET = "test-secret";
  const team = "512301ab-2679-4350-81e1-520a3ab2afd4";
  const scene = "8a5219f1-a635-46f7-9b3e-70d7c02ec63a";
  const objects = new Set<string>();
  const writes: { key: string; cacheControl: string }[] = [];
  const mediaUrl = (value: string) => `https://qr-test.invalid/${value}`;
  const file = path.resolve(__dirname, "../lib/storage/oss.ts");
  const stub = new Module(file);
  stub.filename = file;
  stub.loaded = true;
  stub.exports = {
    mediaUrl,
    headObject: async (value: string) => objects.has(value) ? { key: value } : null,
    putObject: async (value: string, _body: Buffer, options: { cacheControl: string }) => {
      objects.add(value); writes.push({ key: value, cacheControl: options.cacheControl }); return mediaUrl(value);
    },
  };
  require.cache[file] = stub;
  const requests: { path: string; env_version: string; width: number }[] = [];
  let tokens = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.weixin.qq.com");
    if (url.pathname === "/cgi-bin/token") {
      tokens++;
      return Response.json({ access_token: "test-token", expires_in: 7200 });
    }
    assert.equal(url.pathname, "/wxa/getwxacode");
    assert.equal(init?.method, "POST");
    requests.push(JSON.parse(init?.body as string));
    return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { "Content-Type": "image/png" } });
  };
  const keys = await import("../lib/wechat-qr");
  const { getOrCreateQr } = await import("../lib/wechat-qr.server");
  assert.equal(keys.DEFAULT_WECHAT_QR_ENVIRONMENT, "release");
  for (const value of [undefined, null, "", "invalid", "RELEASE", "../release", {}, 0]) {
    assert.equal(keys.isWeChatQrEnvironment(value), false);
  }
  const scenePath = keys.buildSceneMiniProgramPath(team, scene);
  const collectionPath = keys.buildWorkspaceMiniProgramPath(team, scene);
  for (const [qrPath, parameter] of [[scenePath, "sceneId"], [collectionPath, "workspaceId"]]) {
    assert.ok(Buffer.byteLength(qrPath) <= 128, "query must fit the WeChat path limit");
    assert.equal(qrPath.split("?")[0], "pages/index/index");
    const query = new URLSearchParams(qrPath.split("?")[1]);
    assert.equal(query.get(parameter), scene);
    assert.equal(query.get("organizationId"), team);
    assert.equal(query.has(parameter === "sceneId" ? "workspaceId" : "sceneId"), false);
  }
  for (const environment of keys.WECHAT_QR_ENVIRONMENTS) {
    assert.equal(keys.isWeChatQrEnvironment(environment), true);
    const sceneKey = keys.buildSceneQrObjectKey(team, scene, environment);
    const collectionKey = keys.buildQrObjectKey(team, scene, environment);
    assert.equal(sceneKey, `wechat-qrcodes/${environment}/scenes/${team}__${scene}.png`);
    assert.equal(collectionKey, `wechat-qrcodes/${environment}/${team}__${scene}.png`);
    assert.equal(keys.buildQrPublicUrl(team, scene, environment), mediaUrl(collectionKey));
    for (const [key, qrPath] of [[sceneKey, scenePath], [collectionKey, collectionPath]]) {
      const before = requests.length;
      assert.equal(await getOrCreateQr(key, qrPath, environment), mediaUrl(key));
      assert.equal(requests.length, before + 1, "other versions must not satisfy this cache entry");
      assert.deepEqual(requests.at(-1), { path: qrPath, env_version: environment, width: 430 });
      assert.equal(writes.at(-1)?.cacheControl, environment === "release" ? "public, max-age=31536000" : "no-store");
      await getOrCreateQr(key, qrPath, environment);
      assert.equal(requests.length, before + 1, "all versions reuse backend OSS cache");
    }
  }
  assert.equal(objects.size, 6);
  for (const environment of [...keys.WECHAT_QR_ENVIRONMENTS].reverse()) {
    await getOrCreateQr(keys.buildSceneQrObjectKey(team, scene, environment), scenePath, environment);
    await getOrCreateQr(keys.buildQrObjectKey(team, scene, environment), collectionPath, environment);
  }
  assert.equal(requests.length, 6, "switching back reuses each environment's existing QR");
  const key = keys.buildSceneQrObjectKey(team, scene, "develop");
  objects.delete(key);
  await getOrCreateQr(key, scenePath, "develop");
  assert.equal(requests.length, 7, "clearing an OSS image regenerates it");
  assert.equal(tokens, 1, "all QR environments share the access token cache");
  console.log("PASS release default; per-request release/trial/develop; Scene/collection paths; isolated OSS cache; switch-back reuse; cache deletion and token reuse");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
