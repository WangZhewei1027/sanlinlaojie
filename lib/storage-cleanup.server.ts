import "server-only";
import { db, sql } from "@/lib/db";
import { assetKeyFromUrl, deleteObjects } from "@/lib/storage/oss";
import { logError } from "@/lib/log-error";

/**
 * 上传文件（assets/ 前缀）的引用计数清理。
 *
 * 内容 hash 去重 / 复制会让多个 asset 行共享同一个存储对象，且同一对象既可能
 * 被 file_url 引用，也可能被 shop 素材的 metadata.checkin_url 引用（去重按内容
 * 命中，不区分用途）。因此删除文件前必须对两个字段一起计数，任何一处仍有引用
 * 就保留文件。
 *
 * 删除顺序约定：先删行、后删文件。行删掉后计数为 0 才动存储，失败方向只会留下
 * "无行引用的孤儿文件"（不可见、无害），由 /api/admin/clean 的全局清扫兜底；
 * 绝不会出现"行还在但文件没了"的死链。
 */

/** 从公开 URL 解析出 OSS 对象 key（assets/…）；非本站上传文件返回 null。 */
export function storagePathFromUrl(url: string): string | null {
  return assetKeyFromUrl(url);
}

/**
 * 统计仍引用该 URL 的 asset 行数（file_url + metadata.checkin_url 两个来源）。
 */
export async function countFileReferences(url: string): Promise<number> {
  const row = await db
    .selectFrom("asset")
    .select(({ fn }) => fn.countAll<number>().as("count"))
    .where((eb) =>
      eb.or([
        eb("file_url", "=", url),
        eb(sql<string>`metadata->>'checkin_url'`, "=", url),
      ]),
    )
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export type RemoveFileResult = "removed" | "kept" | "failed" | "skipped";

/**
 * 若该 URL 已无任何 asset 行引用，删除对应存储文件。
 * 调用方应在删掉/改掉自己那行之后再调（计数自然不含自己）。
 * 存储删除失败不抛错：记入 error_log 后返回 "failed"，残留文件靠全局清扫兜底。
 */
export async function removeStorageFileIfUnreferenced(
  url: string,
  ctx: { userId?: string; method: string; path: string },
): Promise<RemoveFileResult> {
  const key = storagePathFromUrl(url);
  if (!key) return "skipped";

  const refs = await countFileReferences(url);
  if (refs > 0) return "kept";

  try {
    await deleteObjects([key]);
  } catch (error) {
    console.warn("删除存储文件失败:", error);
    await logError({
      userId: ctx.userId,
      method: ctx.method,
      path: ctx.path,
      status: 500,
      message: `storage remove failed: ${error instanceof Error ? error.message : String(error)}`,
      context: { key, url },
    });
    return "failed";
  }
  return "removed";
}
