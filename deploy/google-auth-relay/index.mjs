import { timingSafeEqual } from "node:crypto";
import { forwardGoogle } from "./google.mjs";

function response(statusCode, data, upstreamStatus) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(upstreamStatus ? { "x-google-upstream-status": String(upstreamStatus) } : {}),
    },
    body: JSON.stringify(data),
    isBase64Encoded: false,
  };
}

export function createHandler(config, fetcher = fetch) {
  return async (event) => {
    if (!config.secret || config.secret.length < 32 || !config.clientId || !config.clientSecret || !config.redirectURI) {
      return response(503, { error: "relay_not_configured" });
    }
    let request;
    try {
      if (Buffer.byteLength(event) > 32768) return response(413, { error: "request_too_large" });
      request = JSON.parse(event.toString());
      if (!request || typeof request !== "object" || Array.isArray(request)) return response(400, { error: "invalid_request" });
    } catch {
      return response(400, { error: "invalid_request" });
    }
    const headers = Object.fromEntries(Object.entries(request.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const received = Buffer.from(String(headers.authorization ?? ""));
    const expected = Buffer.from(`Bearer ${config.secret}`);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return response(401, { error: "unauthorized" });
    }
    const path = request.rawPath;
    const method = request.requestContext?.http?.method;
    if (path !== "/jwks" && path !== "/token") return response(404, { error: "not_found" });
    if (method !== (path === "/jwks" ? "GET" : "POST")) return response(405, { error: "method_not_allowed" });
    if (path === "/token" && !String(headers["content-type"]).startsWith("application/x-www-form-urlencoded")) {
      return response(415, { error: "unsupported_media_type" });
    }
    try {
      const body = request.isBase64Encoded
        ? Buffer.from(request.body ?? "", "base64").toString("utf8") : request.body ?? "";
      if (typeof body !== "string" || Buffer.byteLength(body) > 12288) return response(413, { error: "request_too_large" });
      const result = await forwardGoogle(path, body, config, fetcher);
      return response(result.status, result.data, result.upstreamStatus);
    } catch {
      // Never log authorization codes, tokens, credentials, or upstream response bodies.
      return response(502, { error: "google_unavailable" });
    }
  };
}

export const handler = async (event) => createHandler({
  secret: process.env.GOOGLE_RELAY_SECRET,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectURI: process.env.GOOGLE_REDIRECT_URI,
})(event);
