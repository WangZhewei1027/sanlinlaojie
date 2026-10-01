// Shared (client-safe) constants and URL builders for WeChat mini-program
// QR codes stored in OSS under wechat-qrcodes/. The object key here is the
// cache key — it must stay in sync between the server action that uploads
// (app/manage/actions/wechat-qr.ts) and the client that loads the public URL
// optimistically (components/workspace-qr-button.tsx).

import { mediaUrl, WECHAT_QR_PREFIX } from "@/lib/storage/public-url";

export const WECHAT_QR_ENV_VERSION: "develop" | "trial" | "release" =
  "release";

export function buildQrStoragePath(
  orgId: string,
  workspaceId: string | null,
): string {
  return `${WECHAT_QR_ENV_VERSION}/${orgId}__${workspaceId ?? "none"}.png`;
}

/** Full OSS object key of a QR code. */
export function buildQrObjectKey(
  orgId: string,
  workspaceId: string | null,
): string {
  return `${WECHAT_QR_PREFIX}${buildQrStoragePath(orgId, workspaceId)}`;
}

// Public URLs are deterministic, so the client can construct one without a
// server round trip and simply try to load it.
export function buildQrPublicUrl(
  orgId: string,
  workspaceId: string | null,
): string {
  return mediaUrl(buildQrObjectKey(orgId, workspaceId));
}
