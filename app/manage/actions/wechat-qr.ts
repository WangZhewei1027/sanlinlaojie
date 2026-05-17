"use server";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "wechat-qrcodes";
const ENV_VERSION: "develop" | "trial" | "release" = "develop";
const MINIPROGRAM_PAGE = "pages/index/index";
const QR_WIDTH = 430;

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const GETWXACODE_URL = "https://api.weixin.qq.com/wxa/getwxacode";

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level in-memory cache for the WeChat access_token (valid 7200s).
let tokenCache: TokenCache | null = null;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey)
    throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

function buildStoragePath(orgId: string, workspaceId: string | null): string {
  return `${ENV_VERSION}/${orgId}__${workspaceId ?? "none"}.png`;
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
        env_version: ENV_VERSION,
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
    const orgId = input.organizationId?.trim();
    if (!orgId) {
      return { error: "organizationId is required" };
    }
    const wsId = input.workspaceId?.trim() || null;

    const supabase = getAdminClient();
    const storagePath = buildStoragePath(orgId, wsId);
    const storage = supabase.storage.from(BUCKET);

    // 1. Cache check: try to download. If file exists, return public URL.
    const { error: downloadError } = await storage.download(storagePath);
    if (!downloadError) {
      const { data } = storage.getPublicUrl(storagePath);
      return { url: data.publicUrl };
    }

    // 2. Cache miss: call WeChat to generate.
    const miniProgramPath = buildMiniProgramPath(orgId, wsId);
    const buffer = await fetchQrFromWeChat(miniProgramPath);

    // 3. Upload (treat duplicate as success for race-safety).
    const { error: uploadError } = await storage.upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadError) {
      const msg = uploadError.message?.toLowerCase() ?? "";
      const isDuplicate =
        msg.includes("duplicate") ||
        msg.includes("already exists") ||
        msg.includes("resource already exists");
      if (!isDuplicate) {
        return { error: `Storage upload failed: ${uploadError.message}` };
      }
    }

    const { data } = storage.getPublicUrl(storagePath);
    return { url: data.publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
