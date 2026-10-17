/**
 * Maps API failures onto the presentational `ContentActionResult` contract of
 * app/manage/content. Pages wrap every mutating callback in `runContentAction`
 * so a stale lock, a refused revoke or a missing permission becomes a visible,
 * recoverable state instead of a thrown promise.
 */
import type { DependencyImpact, DependencyItem } from "@/lib/content-model/contracts";
import type { ContentActionResult } from "@/app/manage/content/types";
import { isContentApiError } from "./content-api";
import type { IntegrationT, IntegrationTexts } from "./integration-text";

export const ERROR_TEXTS: IntegrationTexts = {
  "contentModel.integration.impact.draft": ["场景 {{scene}}（草稿，v{{version}}）", "Scene {{scene}} (draft, v{{version}})"],
  "contentModel.integration.impact.revision": ["场景 {{scene}}（发布 #{{revision}}，v{{version}}）", "Scene {{scene}} (revision #{{revision}}, v{{version}})"],
  "contentModel.integration.impact.placement": ["{{collection}} · {{name}}（投放，v{{version}}）", "{{collection}} · {{name}} (placement, v{{version}})"],
  "contentModel.integration.impact.restricted": ["另有 {{count}} 处引用未列出", "{{count}} more not listed"],
  "contentModel.integration.impact.noCollection": ["地图合集", "Map collection"],
  "contentModel.integration.impact.unnamed": ["未命名投放", "Unnamed placement"],
  "contentModel.integration.error.notEnabled": ["该组织尚未启用新的素材与场景模型。", "This organization has not switched to the new asset and scene model."],
  "contentModel.integration.error.readonly": ["组织正在迁移，内容暂时只读。", "The organization is migrating; content is read-only for now."],
  "contentModel.integration.error.upgradeRequired": ["页面版本过旧，请刷新后重试。", "This page is out of date. Refresh and try again."],
  "contentModel.integration.error.network": ["网络错误，请稍后重试。", "Network error. Try again shortly."],
  "contentModel.integration.error.archived": ["对象已归档，无法新增引用或修改。", "The item is archived and cannot be used or changed."],
  "contentModel.integration.error.grantRequired": ["服务器拒绝使用该素材，请刷新后重试。", "The server refused to use this asset. Refresh and try again."],
  "contentModel.integration.error.lock": ["内容已被他人修改。请重新载入后再操作。", "Someone else changed this. Reload before trying again."],
};

export function impactLines(impact: DependencyImpact | undefined, tx: IntegrationT, limit = 8): string[] {
  if (!impact) return [];
  const lines = impact.items.slice(0, limit).map((item) => impactLine(item, tx));
  const hidden = impact.items.length - Math.min(limit, impact.items.length) + impact.restricted_count;
  if (hidden > 0) lines.push(tx("contentModel.integration.impact.restricted", { count: hidden }));
  return lines;
}

function impactLine(item: DependencyItem, tx: IntegrationT) {
  if (item.kind === "scene_draft") return tx("contentModel.integration.impact.draft", { scene: item.scene_name, version: item.version_no });
  if (item.kind === "scene_revision") return tx("contentModel.integration.impact.revision", { scene: item.scene_name, revision: item.revision_no, version: item.version_no });
  return tx("contentModel.integration.impact.placement", {
    collection: item.workspace_name || tx("contentModel.integration.impact.noCollection"),
    name: item.placement_name ?? tx("contentModel.integration.impact.unnamed"),
    version: item.version_no,
  });
}

/** Human message for any thrown value; feature-state codes get product wording. */
export function errorMessage(error: unknown, tx: IntegrationT): string {
  if (!isContentApiError(error)) return error instanceof Error ? error.message : String(error);
  switch (error.code) {
    case "CONTENT_MODEL_NOT_ENABLED": return tx("contentModel.integration.error.notEnabled");
    case "CONTENT_MODEL_READONLY": return tx("contentModel.integration.error.readonly");
    case "CONTENT_MODEL_UPGRADE_REQUIRED": return tx("contentModel.integration.error.upgradeRequired");
    case "ARCHIVED": return error.message || tx("contentModel.integration.error.archived");
    case "GRANT_REQUIRED": return error.message || tx("contentModel.integration.error.grantRequired");
    case "LOCK_VERSION_CONFLICT":
    case "LOCK_VERSION_REQUIRED": return tx("contentModel.integration.error.lock");
    default: return error.status === 0 ? tx("contentModel.integration.error.network") : error.message;
  }
}

export function toActionResult(error: unknown, tx: IntegrationT): Extract<ContentActionResult, { ok: false }> {
  const message = errorMessage(error, tx);
  if (!isContentApiError(error)) return { ok: false, kind: "error", message };
  switch (error.code) {
    case "LOCK_VERSION_CONFLICT":
    case "LOCK_VERSION_REQUIRED":
    case "IDEMPOTENCY_CONFLICT":
    case "ARCHIVED":
    case "LEGACY_AMBIGUOUS":
      return { ok: false, kind: "conflict", message };
    case "DEPENDENCY_CONFLICT":
      return { ok: false, kind: "conflict", message: error.message, details: impactLines(error.details?.impact, tx) };
    case "FORBIDDEN":
    case "GRANT_REQUIRED":
    case "CONTENT_MODEL_READONLY":
    case "UNAUTHENTICATED":
      return { ok: false, kind: "forbidden", message };
    default:
      return { ok: false, kind: "error", message };
  }
}

/** Run a mutation and translate failures; `onSuccess` refreshes page state. */
export async function runContentAction<T>(
  action: () => Promise<T>,
  tx: IntegrationT,
  onSuccess?: (value: T) => void | Promise<void>,
): Promise<ContentActionResult> {
  try {
    const value = await action();
    await onSuccess?.(value);
    return { ok: true };
  } catch (error) {
    return toActionResult(error, tx);
  }
}
