// node --import tsx --conditions react-server --test scripts/test-google-relay.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { fixture, site } from "./lib/google-relay-test-fixture.mjs";
import { googleRelay } from "../lib/auth/google-relay.server.ts";

test("Google callback registers a user, verifies Google's JWT and preserves PKCE/session handling", async (t) => {
  const { db, calls, complete } = await fixture(t);
  const { result, authorization } = await complete();
  assert.equal(result.status, 302);
  assert.equal(new URL(result.headers.get("location"), site).pathname, "/manage");
  assert.equal(db.user.length, 1);
  assert.equal(db.account[0].providerId, "google");
  assert.equal(db.account[0].accountId, "google-subject");
  assert.equal(db.session.length, 1);
  const exchange = calls.find((call) => call.path === "/token");
  assert.equal(createHash("sha256").update(exchange.body.get("code_verifier")).digest("base64url"), authorization.searchParams.get("code_challenge"));
  assert.ok(calls.some((call) => call.path === "/jwks"));
});
test("verified existing email links to the same user while unverified email is not auto-linked", async (t) => {
  for (const verified of [true, false]) {
    await t.test(String(verified), async (t) => {
      const { db, complete } = await fixture(t, { existingVerified: verified });
      const { result } = await complete();
      assert.equal(db.user.length, 1);
      assert.equal(db.account.length, verified ? 2 : 1);
      assert.equal(db.session.length, verified ? 1 : 0);
      if (verified) assert.equal(db.account.find((account) => account.providerId === "google").userId, "existing-user");
      else assert.equal(new URL(result.headers.get("location"), site).pathname, "/auth/login");
    });
  }
});
test("wrong audience, issuer, expired or forged JWTs cannot create accounts", async (t) => {
  for (const claims of [{ aud: "other-client" }, { iss: "https://attacker.example" }, { exp: 1 }]) {
    await t.test(JSON.stringify(claims), async (t) => {
      const { db, complete } = await fixture(t, { claims });
      await complete();
      assert.equal(db.user.length + db.session.length, 0);
    });
  }
  await t.test("forged signature", async (t) => {
    const { auth, token } = await fixture(t);
    const provider = (await auth.$context).socialProviders.find((p) => p.id === "google");
    const forged = token.slice(0, token.lastIndexOf(".") + 1) + "forged";
    assert.equal(await provider.getUserInfo({ idToken: forged }), null);
    assert.equal(await verifyProviderIdToken(provider, forged), false);
    assert.equal(await verifyProviderIdToken(provider, token), true);
  });
});
test("relay outages fail Google login without creating a session or leaking transport details", async (t) => {
  const { complete, db } = await fixture(t, { unavailable: true });
  const { result } = await complete();
  assert.equal(new URL(result.headers.get("location"), site).pathname, "/auth/login");
  assert.equal(db.user.length + db.session.length, 0);
  assert.ok(!result.headers.get("location").includes("private"));
});
test("refresh uses relay and invalid relay configuration fails closed", async (t) => {
  const { auth, calls } = await fixture(t);
  const provider = (await auth.$context).socialProviders.find((p) => p.id === "google");
  const tokens = await provider.refreshAccessToken("old-refresh");
  assert.equal(tokens.accessToken, "access");
  assert.equal(calls[0].body.get("grant_type"), "refresh_token");
  for (const url of ["http://relay.example", "https://user:pass@relay.example", "https://relay.example/path", "https://relay.example?token=x"]) {
    assert.throws(() => googleRelay(url, "secret".repeat(8)));
  }
  assert.throws(() => googleRelay("https://relay.example", "short"));
});
