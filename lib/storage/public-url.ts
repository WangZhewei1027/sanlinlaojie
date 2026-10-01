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

/** Object key of a URL under our media host; null for any other URL. */
export function mediaKeyFromUrl(url: string): string | null {
  if (!MEDIA_BASE_URL) return null;
  if (!url.startsWith(`${MEDIA_BASE_URL}/`)) return null;
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    const base = new URL(MEDIA_BASE_URL).pathname.replace(/^\/+|\/+$/g, "");
    const key = base && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path;
    return key ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

/** Key of an uploaded media file (assets/…), or null if the URL is not one of ours. */
export function assetKeyFromUrl(url: string): string | null {
  const key = mediaKeyFromUrl(url);
  return key && key.startsWith(ASSETS_PREFIX) ? key : null;
}
