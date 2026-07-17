// Shared (client-safe) constants and URL builders for WeChat mini-program
// QR codes stored in Supabase Storage. The storage path format here is the
// cache key — it must stay in sync between the server action that uploads
// (app/manage/actions/wechat-qr.ts) and the client that loads the public URL
// optimistically (components/workspace-qr-button.tsx).

export const WECHAT_QR_BUCKET = "wechat-qrcodes";
export const WECHAT_QR_ENV_VERSION: "develop" | "trial" | "release" =
  "release";

export function buildQrStoragePath(
  orgId: string,
  workspaceId: string | null,
): string {
  return `${WECHAT_QR_ENV_VERSION}/${orgId}__${workspaceId ?? "none"}.png`;
}

// Public-bucket URLs are deterministic, so the client can construct one
// without a server round trip and simply try to load it.
export function buildQrPublicUrl(
  orgId: string,
  workspaceId: string | null,
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${WECHAT_QR_BUCKET}/${buildQrStoragePath(orgId, workspaceId)}`;
}
