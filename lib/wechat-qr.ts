// Shared (client-safe) constants and URL builders for WeChat mini-program
// QR codes stored in OSS under wechat-qrcodes/. The object key here is the
// cache key used by the shared server-side generator.

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

export function buildSceneQrObjectKey(organizationId: string, sceneId: string): string {
  return `${WECHAT_QR_PREFIX}${WECHAT_QR_ENV_VERSION}/scenes/${organizationId}__${sceneId}.png`;
}
export function buildWorkspaceMiniProgramPath(organizationId: string, workspaceId: string | null): string {
  const params = new URLSearchParams({ organizationId });
  if (workspaceId) params.set("workspaceId", workspaceId);
  return `pages/index/index?${params}`;
}
export function buildSceneMiniProgramPath(organizationId: string, sceneId: string): string {
  return `pages/index/index?${new URLSearchParams({ organizationId, sceneId })}`;
}
