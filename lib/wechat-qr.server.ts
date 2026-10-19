import "server-only";
import { headObject, mediaUrl, putObject } from "@/lib/storage/oss";
import type { WeChatQrEnvironment } from "@/lib/wechat-qr";
const QR_WIDTH = 430;

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const GETWXACODE_URL = "https://api.weixin.qq.com/wxa/getwxacode";

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level in-memory cache for the WeChat access_token (valid 7200s).
// Fine for a single app instance; share it (e.g. Redis) before scaling out.
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_APPSECRET;
  if (!appid || !secret) {
    throw new Error("Missing WECHAT_APPID / WECHAT_APPSECRET");
  }

  const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(
    appid,
  )}&secret=${encodeURIComponent(secret)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.access_token) {
    throw new Error(
      `WeChat token error: ${data.errcode ?? "?"} ${data.errmsg ?? "unknown"}`,
    );
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000,
  };
  return tokenCache.token;
}

async function fetchQrFromWeChat(path: string, environment: WeChatQrEnvironment): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(
    `${GETWXACODE_URL}?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        env_version: environment,
        width: QR_WIDTH,
      }),
      cache: "no-store",
    },
  );
  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (contentType.includes("application/json")) {
    let errmsg = "WeChat getwxacode failed";
    try {
      const json = JSON.parse(buffer.toString()) as {
        errcode?: number;
        errmsg?: string;
      };
      errmsg = `WeChat getwxacode error ${json.errcode ?? "?"}: ${
        json.errmsg ?? "unknown"
      }`;
    } catch {
      // ignore parse error, keep default message
    }
    throw new Error(errmsg);
  }
  return buffer;
}


/** Both map collections and scenes share token caching, OSS caching and generation. */
export async function getOrCreateQr(key: string, path: string, environment: WeChatQrEnvironment): Promise<string> {
  try { if (await headObject(key)) return mediaUrl(key); } catch { /* regenerate a missing cache entry */ }
  const buffer = await fetchQrFromWeChat(path, environment);
  // All versions reuse OSS objects. For debug versions, avoid stale browser/CDN images.
  const cacheControl = environment === "release" ? "public, max-age=31536000" : "no-store";
  return putObject(key, buffer, { contentType: "image/png", cacheControl });
}
