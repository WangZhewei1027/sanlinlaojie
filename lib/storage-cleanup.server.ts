import "server-only";
import { assetKeyFromUrl } from "@/lib/storage/oss";
import { releaseObjectsIfUnreferenced } from "@/lib/storage/retention.server";

/**
 * 上传文件（assets/ 前缀）的单文件回收入口，统一走 lib/storage/retention.server.ts
 * 的对象 key 锁协议：
 *
 * - 保留集合覆盖版本资源、匹配特征、未过期上传回执、归档文件保留记录，
 *   以及同名音频转码文件（.webm ↔ .m4a）。
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
