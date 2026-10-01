"use server";

import { getSessionUser } from "@/lib/auth/server";
import { headObject, mediaUrl, putObject } from "@/lib/storage/oss";
import { WECHAT_QR_ENV_VERSION, buildQrObjectKey } from "@/lib/wechat-qr";

const MINIPROGRAM_PAGE = "pages/index/index";
// QR content never changes for a given org/workspace, so let browsers/CDN
// cache the image long-term (1 year).
const QR_CACHE_CONTROL = "public, max-age=31536000";
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

function buildMiniProgramPath(
  orgId: string,
  workspaceId: string | null,
): string {
  const params = new URLSearchParams({ organizationId: orgId });
  if (workspaceId) params.set("workspaceId", workspaceId);
  return `${MINIPROGRAM_PAGE}?${params.toString()}`;
}

async function fetchQrFromWeChat(path: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(
    `${GETWXACODE_URL}?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        env_version: WECHAT_QR_ENV_VERSION,
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

export async function getOrCreateWorkspaceQRCode(input: {
  organizationId: string;
  workspaceId?: string | null;
}): Promise<{ url?: string; error?: string }> {
  try {
    // Generating codes spends WeChat API quota: signed-in users only.
    if (!(await getSessionUser())) {
      return { error: "未授权" };
    }

    const orgId = input.organizationId?.trim();
    if (!orgId) {
      return { error: "organizationId is required" };
    }
    const wsId = input.workspaceId?.trim() || null;
    const key = buildQrObjectKey(orgId, wsId);

    // 1. Cache check via HEAD (no body transfer). A transient failure counts
    // as a miss — re-uploading the same content is harmless.
    let exists = false;
    try {
      exists = (await headObject(key)) !== null;
    } catch {
      // fall through to regeneration
    }
    if (exists) {
      return { url: mediaUrl(key) };
    }

    // 2. Cache miss: call WeChat to generate, then store.
    const miniProgramPath = buildMiniProgramPath(orgId, wsId);
    const buffer = await fetchQrFromWeChat(miniProgramPath);
    const url = await putObject(key, buffer, {
      contentType: "image/png",
      cacheControl: QR_CACHE_CONTROL,
    });
    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
