import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { googleRelay } from "../../lib/auth/google-relay.server.ts";
export const site = "https://app.example";
export const clientId = "test-google-client";
export async function fixture(t, { existingVerified, claims = {}, unavailable = false } = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const token = await new SignJWT({ email: "person@example.com", email_verified: true, name: "Test", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" }).setSubject("google-subject")
    .setIssuer(claims.iss ?? "https://accounts.google.com").setAudience(claims.aud ?? clientId)
    .setIssuedAt().setExpirationTime(claims.exp ?? "1h").sign(privateKey);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).origin, "https://relay.example");
    assert.equal(options.headers.authorization, `Bearer ${"relay-secret-".repeat(4)}`);
    assert.equal(options.redirect, "error");
    calls.push({ path: new URL(url).pathname, body: options.body });
    if (unavailable) throw new Error("private transport detail");
    return Response.json(new URL(url).pathname === "/jwks" ? { keys: [jwk] } : { access_token: "access", id_token: token, expires_in: 3600, refresh_token: "refresh" });
  });
  const db = { user: [], account: [], session: [], verification: [] };
  if (existingVerified !== undefined) {
    db.user.push({ id: "existing-user", email: "person@example.com", name: "Existing", emailVerified: existingVerified, createdAt: new Date(), updatedAt: new Date() });
    db.account.push({ id: "existing-credential", userId: "existing-user", accountId: "existing-user", providerId: "credential", password: "unused", createdAt: new Date(), updatedAt: new Date() });
  }
  const auth = betterAuth({ baseURL: site, secret: "test-auth-secret-0123456789-abcdefghijklmnopqrstuvwxyz", database: memoryAdapter(db), socialProviders: { google: { clientId, clientSecret: "test-secret" } }, plugins: [googleRelay("https://relay.example", "relay-secret-".repeat(4))], logger: { disabled: true }, rateLimit: { enabled: false } });
  async function complete() {
    const start = await auth.handler(new Request(`${site}/api/auth/sign-in/social`, { method: "POST", headers: { "content-type": "application/json", origin: site }, body: JSON.stringify({ provider: "google", callbackURL: "/manage", errorCallbackURL: "/auth/login" }) }));
    const authorization = new URL((await start.json()).url);
    const cookie = start.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.equal(authorization.searchParams.get("redirect_uri"), `${site}/api/auth/callback/google`);
    const result = await auth.handler(new Request(`${site}/api/auth/callback/google?code=test-code&state=${authorization.searchParams.get("state")}`, { headers: { cookie } }));
    return { result, authorization };
  }
  return { auth, db, calls, token, complete };
}
