const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export async function readLimited(response, limit = 65536) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing upstream body");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error("Upstream response too large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export function tokenParameters(body, config) {
  const input = new URLSearchParams(body);
  const allowed = input.get("grant_type") === "authorization_code"
    ? ["grant_type", "code", "code_verifier", "redirect_uri"]
    : input.get("grant_type") === "refresh_token"
      ? ["grant_type", "refresh_token"] : [];
  if (!allowed.length || [...input.keys()].some((key) => !allowed.includes(key))) return null;
  if (allowed.some((key) => input.getAll(key).length !== 1 || !input.get(key) || input.get(key).length > 4096)) return null;
  if (input.get("grant_type") === "authorization_code") {
    if (input.get("redirect_uri") !== config.redirectURI) return null;
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.get("code_verifier"))) return null;
  }
  input.set("client_id", config.clientId);
  input.set("client_secret", config.clientSecret);
  return input;
}

// The destinations are constants: callers cannot select an upstream URL or headers.
export async function forwardGoogle(path, body, config, fetcher = fetch) {
  const params = path === "/token" ? tokenParameters(body, config) : null;
  if (path === "/token" && !params) return { status: 400, data: { error: "invalid_request" } };
  const response = await fetcher(path === "/jwks" ? JWKS_URL : TOKEN_URL, {
    method: path === "/jwks" ? "GET" : "POST",
    headers: { accept: "application/json", ...(params ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    ...(params ? { body: params } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const error = await readLimited(response).catch(() => ({}));
    const upstreamError = ["invalid_grant", "invalid_client", "invalid_request", "unauthorized_client", "unsupported_grant_type"].includes(error.error)
      ? error.error : undefined;
    return {
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
      data: { error: "google_request_rejected", upstreamError },
      upstreamStatus: response.status,
    };
  }
  const data = await readLimited(response);
  if (path === "/jwks" ? !Array.isArray(data.keys) : typeof data.access_token !== "string") {
    throw new Error("Invalid upstream response");
  }
  return { status: 200, data, upstreamStatus: response.status };
}
