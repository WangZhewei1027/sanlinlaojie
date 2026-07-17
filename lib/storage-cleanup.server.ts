import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log-error";

/**
 * assets 桶存储文件的引用计数清理。
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

export const ASSETS_STORAGE_PATH_RE =
  /\/storage\/v1\/object\/public\/assets\/(.+)/;

/** 从公开 URL 解析出 assets 桶内路径；非本桶 URL 返回 null。 */
export function storagePathFromUrl(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(ASSETS_STORAGE_PATH_RE);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * 统计仍引用该 URL 的 asset 行数（file_url + metadata.checkin_url 两个来源）。
 * 用 count 模式（head:true），不受 PostgREST 1000 行截断影响。
 */
export async function countFileReferences(
  supabase: SupabaseClient,
  url: string,
): Promise<number> {
  const [byFileUrl, byCheckinUrl] = await Promise.all([
    supabase
      .from("asset")
      .select("id", { count: "exact", head: true })
      .eq("file_url", url),
    supabase
      .from("asset")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>checkin_url", url),
  ]);

  if (byFileUrl.error) throw byFileUrl.error;
  if (byCheckinUrl.error) throw byCheckinUrl.error;

  return (byFileUrl.count ?? 0) + (byCheckinUrl.count ?? 0);
}

export type RemoveFileResult = "removed" | "kept" | "failed" | "skipped";

/**
 * 若该 URL 已无任何 asset 行引用，删除对应存储文件。
 * 调用方应在删掉/改掉自己那行之后再调（计数自然不含自己）。
 * 存储删除失败不抛错：记入 error_log 后返回 "failed"，残留文件靠全局清扫兜底。
 */
export async function removeStorageFileIfUnreferenced(
  supabase: SupabaseClient,
  url: string,
  ctx: { userId?: string; method: string; path: string },
): Promise<RemoveFileResult> {
  const filePath = storagePathFromUrl(url);
  if (!filePath) return "skipped";

  const refs = await countFileReferences(supabase, url);
  if (refs > 0) return "kept";

  const { error } = await supabase.storage.from("assets").remove([filePath]);
  if (error) {
    console.warn("删除存储文件失败:", error);
    await logError(supabase, {
      userId: ctx.userId,
      method: ctx.method,
      path: ctx.path,
      status: 500,
      message: `storage remove failed: ${error.message}`,
      context: { filePath, url },
    });
    return "failed";
  }
  return "removed";
}
