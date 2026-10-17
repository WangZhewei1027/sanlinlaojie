import "server-only";
import { db } from "@/lib/db";
import { assetKeyFromUrl } from "@/lib/storage/oss";
import { isKeyProtected, releaseObjectsIfUnreferenced } from "@/lib/storage/retention.server";

/**
 * 上传文件（assets/ 前缀）的单文件回收入口，统一走 lib/storage/retention.server.ts
 * 的对象 key 锁协议：
 *
 * - 保留集合覆盖全部 asset_version_resource、旧 asset 的 file_url /
 *   metadata.checkin_url / JSON 内嵌地址、匹配点参考图、未过期上传回执（在途
 *   上传），以及同名派生文件（.webm ↔ .m4a）。
 * - 删除方持 `object-key:<key>` 锁完成最后检查与实际删除；复用方持同一把锁
 *   写入租约/资源行。
 * - 迁移期间实际删除默认关闭（app_config.managed_object_deletion），只产生
 *   候选，返回 "deferred"。
 *
 * 删除顺序仍是先删/改行、后回收文件：失败方向只会留下孤儿文件，由
 * /api/admin/clean 兜底，不会出现"行还在但文件没了"的死链。
 */

/** 从公开 URL 解析出 OSS 对象 key（assets/…）；非本站上传文件返回 null。 */
export function storagePathFromUrl(url: string): string | null {
  return assetKeyFromUrl(url);
}

/** 该 URL 对应的对象是否仍受保护（任一引用来源、派生文件或有效回执）。 */
export async function isFileReferenced(url: string): Promise<boolean> {
  const key = storagePathFromUrl(url);
  return key ? isKeyProtected(db, key) : false;
}

/** 兼容旧调用方：> 0 表示仍受保护。 */
export async function countFileReferences(url: string): Promise<number> {
  return (await isFileReferenced(url)) ? 1 : 0;
}

export type RemoveFileResult = "removed" | "kept" | "failed" | "skipped" | "deferred";

/**
 * 若该 URL 的对象已无任何保护，回收它（或在删除关闭时登记为候选）。
 * 调用方应在删掉/改掉自己那行之后再调。存储失败不抛错。
 */
export async function removeStorageFileIfUnreferenced(
  url: string,
  ctx: { userId?: string; method: string; path: string },
): Promise<RemoveFileResult> {
  const key = storagePathFromUrl(url);
  if (!key) return "skipped";
  const report = await releaseObjectsIfUnreferenced([key], ctx);
  if (report.removed.length) return "removed";
  if (report.kept.length) return "kept";
  if (report.candidates.length) return "deferred";
  if (report.failed.length) return "failed";
  return "skipped";
}
