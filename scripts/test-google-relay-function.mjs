import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../deploy/google-auth-relay/index.mjs";
const config = { secret: "test-relay-secret-".repeat(3), clientId: "client", clientSecret: "private-client-secret", redirectURI: "https://app.example/api/auth/callback/google" };
const valid = { grant_type: "authorization_code", code: "test-code", code_verifier: "x".repeat(43), redirect_uri: config.redirectURI };
const event = (path, body = "", overrides = {}) => Buffer.from(JSON.stringify({ rawPath: path, requestContext: { http: { method: path === "/jwks" ? "GET" : "POST" } }, headers: { authorization: `Bearer ${config.secret}`, "content-type": "application/x-www-form-urlencoded" }, body, ...overrides }));
const noNetwork = async () => { throw new Error("Network must not be called"); };

test("missing or wrong relay credentials are rejected before any upstream request", async () => {
  const handler = createHandler(config, noNetwork);
  for (const headers of [{}, { authorization: "Bearer wrong" }]) assert.equal((await handler(event("/jwks", "", { headers }))).statusCode, 401);
  assert.equal((await createHandler({ ...config, secret: "" }, noNetwork)(event("/jwks"))).statusCode, 503);
});
test("relay rejects unknown paths, methods, content types and oversized events", async () => {
  const handler = createHandler(config, noNetwork);
  assert.equal((await handler(event("/https://attacker.example"))).statusCode, 404);
  assert.equal((await handler(event("/token", "", { requestContext: { http: { method: "GET" } } }))).statusCode, 405);
  assert.equal((await handler(event("/token", "", { headers: { authorization: `Bearer ${config.secret}` } }))).statusCode, 415);
  assert.equal((await handler(event("/token", "x".repeat(33000)))).statusCode, 413);
  assert.equal((await handler(Buffer.from("not-json"))).statusCode, 400);
});
test("only configured redirect, PKCE, known grants and unique fields are accepted", async () => {
  const handler = createHandler(config, noNetwork);
  for (const input of [ { ...valid, redirect_uri: "https://evil.example" }, { ...valid, code_verifier: "short" }, { ...valid, grant_type: "password" }, { ...valid, client_id: "other-client" }, { ...valid, url: "http://169.254.169.254" } ]) {
    assert.equal((await handler(event("/token", new URLSearchParams(input).toString()))).statusCode, 400);
  }
  assert.equal((await handler(event("/token", new URLSearchParams(valid) + "&code=duplicate"))).statusCode, 400);
});
test("authorization code exchange forwards only to Google with server-owned credentials", async () => {
  const handler = createHandler(config, async (url, options) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    assert.equal(options.redirect, "error");
    assert.equal(options.body.get("client_id"), config.clientId);
    assert.equal(options.body.get("client_secret"), config.clientSecret);
    assert.equal(options.body.get("code_verifier"), valid.code_verifier);
    assert.equal(options.body.get("redirect_uri"), valid.redirect_uri);
    return Response.json({ access_token: "access", id_token: "identity", expires_in: 3600 });
  });
  const body = Buffer.from(new URLSearchParams(valid).toString()).toString("base64");
  const result = await handler(event("/token", body, { isBase64Encoded: true }));
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).id_token, "identity");
  assert.equal(result.headers["cache-control"], "no-store");
});
test("refresh and public-key retrieval use the expected upstream endpoints", async () => {
  const handler = createHandler(config, async (url, options) => {
    if (url.endsWith("/certs")) { assert.equal(options.method, "GET"); return Response.json({ keys: [{ kid: "one" }] }); }
    assert.equal(url, "https://oauth2.googleapis.com/token");
    assert.equal(options.body.get("grant_type"), "refresh_token");
    assert.equal(options.body.get("refresh_token"), "refresh");
    return Response.json({ access_token: "new-access" });
  });
  assert.equal((await handler(event("/jwks"))).statusCode, 200);
  assert.equal((await handler(event("/token", "grant_type=refresh_token&refresh_token=refresh"))).statusCode, 200);
});
test("timeouts, redirects and malformed upstream responses fail closed without leaking details", async () => {
  for (const fetcher of [async () => { throw new Error(config.clientSecret); }, async () => new Response("not-json"), async () => Response.json({ access_token: "secret" }, { status: 400 }), async () => new Response("x".repeat(70000))]) {
    const result = await createHandler(config, fetcher)(event("/token", new URLSearchParams(valid).toString()));
    assert.ok([400, 502].includes(result.statusCode));
    assert.ok(!result.body.includes(config.clientSecret));
    assert.ok(!result.body.includes("secret"));
  }
});
