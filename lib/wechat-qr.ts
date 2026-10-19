// Shared QR environment contract and OSS cache keys. Each request chooses its
// environment; browser preferences never change the server's global state.

import { mediaUrl, WECHAT_QR_PREFIX } from "@/lib/storage/public-url";

export const WECHAT_QR_ENVIRONMENTS = ["release", "trial", "develop"] as const;
export type WeChatQrEnvironment = (typeof WECHAT_QR_ENVIRONMENTS)[number];
export const DEFAULT_WECHAT_QR_ENVIRONMENT: WeChatQrEnvironment = "release";

export function isWeChatQrEnvironment(value: unknown): value is WeChatQrEnvironment {
  return value === "release" || value === "trial" || value === "develop";
}

export function buildQrStoragePath(
  orgId: string,
  workspaceId: string | null,
  environment: WeChatQrEnvironment,
): string {
  return `${environment}/${orgId}__${workspaceId ?? "none"}.png`;
}

/** Full OSS object key of a QR code. */
export function buildQrObjectKey(
  orgId: string,
  workspaceId: string | null,
  environment: WeChatQrEnvironment,
): string {
  return `${WECHAT_QR_PREFIX}${buildQrStoragePath(orgId, workspaceId, environment)}`;
}

// Public URLs use the same requested environment as the generator.
export function buildQrPublicUrl(
  orgId: string,
  workspaceId: string | null,
  environment: WeChatQrEnvironment,
): string {
  return mediaUrl(buildQrObjectKey(orgId, workspaceId, environment));
}

export function buildSceneQrObjectKey(organizationId: string, sceneId: string, environment: WeChatQrEnvironment): string {
  return `${WECHAT_QR_PREFIX}${environment}/scenes/${organizationId}__${sceneId}.png`;
}
export function buildWorkspaceMiniProgramPath(organizationId: string, workspaceId: string | null): string {
  const params = new URLSearchParams({ organizationId });
  if (workspaceId) params.set("workspaceId", workspaceId);
  return `pages/index/index?${params}`;
}
export function buildSceneMiniProgramPath(organizationId: string, sceneId: string): string {
  return `pages/index/index?${new URLSearchParams({ organizationId, sceneId })}`;
}
