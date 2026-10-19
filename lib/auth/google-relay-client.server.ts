import "server-only";
import { createRemoteJWKSet, customFetch } from "jose";
import { getOAuth2Tokens } from "better-auth/oauth2";

export function createGoogleRelayClient(baseURL: string, secret: string) {
  const base = new URL(baseURL);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/" || (base.port && base.port !== "443") || secret.length < 32) {
    throw new Error("Invalid Google relay configuration");
  }
  async function request(path: "/token" | "/jwks", body?: URLSearchParams) {
    try {
      const response = await fetch(new URL(path, base), {
        method: body ? "POST" : "GET",
        headers: {
          authorization: `Bearer ${secret}`,
          ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Google relay request rejected");
      }
      return response;
    } catch {
      // Better Auth logs thrown errors; omit URLs, request bodies and secrets.
      throw new Error("Google authentication service unavailable");
    }
  }
  const jwks = createRemoteJWKSet(new URL("/jwks", base), {
    [customFetch]: () => request("/jwks"),
    timeoutDuration: 12000,
    cacheMaxAge: 300000,
  });
  async function exchange(parameters: Record<string, string>) {
    const response = await request("/token", new URLSearchParams(parameters));
    const text = await response.text();
    if (text.length > 65536) throw new Error("Invalid Google token response");
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid Google token response"); }
    if (!data || typeof data.access_token !== "string" || (parameters.grant_type === "authorization_code" && typeof data.id_token !== "string")) {
      throw new Error("Invalid Google token response");
    }
    return getOAuth2Tokens(data);
  }
  return { jwks, exchange };
}
