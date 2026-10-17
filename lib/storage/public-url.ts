// Client-safe helpers for media URLs. Every stored file lives in one OSS
// bucket and is served from NEXT_PUBLIC_MEDIA_BASE_URL (the CDN / custom
// domain, or the raw bucket endpoint before the domain is bound). The
// database stores full URLs, so switching hosts later is a URL rewrite plus
// a change of this variable — see docs/aliyun-migration-plan.md §6.
//
// Object key layout (the part after the base URL):
//   assets/{userId}/{timestamp}-{random}.{ext}   uploaded media
//   wechat-qrcodes/release/{orgId}__{wsId|none}.png
//   static/…                                     Cesium build, 3D models
//   tiles/terra_b3dms/…                          Cesium 3D tileset

export const MEDIA_BASE_URL = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ""
).replace(/\/+$/, "");

export const ASSETS_PREFIX = "assets/";
export const WECHAT_QR_PREFIX = "wechat-qrcodes/";

/** Public URL of an object key. */
export function mediaUrl(key: string): string {
  if (!MEDIA_BASE_URL) throw new Error("NEXT_PUBLIC_MEDIA_BASE_URL is not set");
  return `${MEDIA_BASE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Object key of a URL under our media host; null for any other URL.
 * Canonical comparison: host case-insensitive, scheme and port ignored (the
 * same host can never be "external"), query and fragment ignored, and the
 * path must sit under the base path segment by segment.
 */
export function mediaKeyFromUrl(url: string): string | null {
  if (!MEDIA_BASE_URL) return null;
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(MEDIA_BASE_URL);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname.toLowerCase() !== base.hostname.toLowerCase()) return null;
  const basePath = base.pathname.replace(/\/+$/, "");
  if (basePath && !parsed.pathname.startsWith(`${basePath}/`)) return null;
  const rest = parsed.pathname.slice(basePath.length).replace(/^\/+/, "");
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

/** Every managed object key mentioned anywhere inside free text. */
export function mediaKeysInText(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.match(/https?:\/\/[^\s"'<>()\[\]{}]+/gi) ?? []) {
    const key = mediaKeyFromUrl(match);
    if (key) keys.push(key);
  }
  return keys;
}

/** Key of an uploaded media file (assets/…), or null if the URL is not one of ours. */
export function assetKeyFromUrl(url: string): string | null {
  const key = mediaKeyFromUrl(url);
  return key && key.startsWith(ASSETS_PREFIX) ? key : null;
}
