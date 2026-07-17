import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logErrorSafe } from "@/lib/log-error";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { storagePathFromUrl } from "@/lib/storage-cleanup.server";

/**
 * 存储/数据库一致性清扫（仅 super_admin）：
 *
 * - clean-rows：按 workspace 扫描资产行，删除其 file_url 指向的存储文件已不存在
 *   的死链行（需要 workspaceId）。
 * - clean-files：全桶递归遍历 assets 桶，对比全表引用（file_url +
 *   metadata.checkin_url），删除没有任何行引用的孤儿文件。这是所有删除路径
 *   "先删行、后删文件，存储失败不阻断"策略的兜底清扫，必须全局对比——
 *   内容 hash 去重会让文件被任意 workspace/组织的资产共享，按单 workspace
 *   对比会误删共享文件。刚上传、行可能尚未落库的新文件（24 小时内）跳过。
 */

const ORPHAN_FILE_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const STORAGE_LIST_PAGE = 1000;

interface CleanResult {
  orphanedRows: {
    id: string;
    file_url: string;
    reason: string;
  }[];
  orphanedFiles: {
    path: string;
    name: string;
  }[];
  deletedRows: string[];
  deletedFiles: string[];
  errors: string[];
}

interface StorageFileEntry {
  path: string;
  createdAt: string | null;
}

/** 递归列出 assets 桶内所有文件（分页 + 子目录下钻）。 */
async function listAllBucketFiles(
  storage: ReturnType<Awaited<ReturnType<typeof createClient>>["storage"]["from"]>,
): Promise<StorageFileEntry[]> {
  const files: StorageFileEntry[] = [];
  const dirs: string[] = [""];

  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.list(dir, {
        limit: STORAGE_LIST_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`列出 ${dir || "/"} 失败: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const entry of data) {
        if (!entry.name) continue;
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        // Supabase list 里目录条目没有 id
        if (entry.id == null) {
          dirs.push(path);
        } else if (entry.name !== ".emptyFolderPlaceholder") {
          files.push({ path, createdAt: entry.created_at ?? null });
        }
      }

      if (data.length < STORAGE_LIST_PAGE) break;
      offset += data.length;
    }
  }
  return files;
}

/** 全表引用集合：所有 file_url 与 metadata.checkin_url 能解析出的桶内路径。 */
async function fetchReferencedPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const { data, error } = await fetchAllRows<{
    file_url: string | null;
    checkin_url: string | null;
  }>(() =>
    supabase
      .from("asset")
      .select("file_url, checkin_url:metadata->>checkin_url")
      .order("id", { ascending: true }),
  );
  if (error) throw new Error(`查询资产引用失败: ${error.message}`);

  const referenced = new Set<string>();
  for (const row of data) {
    for (const url of [row.file_url, row.checkin_url]) {
      if (!url) continue;
      const path = storagePathFromUrl(url);
      if (path) referenced.add(path);
    }
  }
  return referenced;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 验证用户权限
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      await logErrorSafe({
        method: "POST",
        path: "/api/admin/clean",
        status: 403,
        message: "权限不足: 仅 super_admin 可清理",
      });
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { workspaceId, action } = body;
    // action: "clean-rows" | "clean-files" | "both"

    const wantRows = action === "clean-rows" || action === "both";
    const wantFiles = action === "clean-files" || action === "both";

    if (wantRows && !workspaceId) {
      return NextResponse.json({ error: "请选择工作空间" }, { status: 400 });
    }

    const result: CleanResult = {
      orphanedRows: [],
      orphanedFiles: [],
      deletedRows: [],
      deletedFiles: [],
      errors: [],
    };

    // 1. 检查并清理数据库中文件不存在的记录（按 workspace）
    if (wantRows) {
      try {
        // 分页拉全量，避免 1000 行截断漏检
        const { data: assets, error: fetchError } = await fetchAllRows<{
          id: string;
          file_url: string | null;
        }>(() =>
          supabase
            .from("asset")
            .select("id, file_url")
            .contains("workspace_id", [workspaceId])
            .not("file_url", "is", null)
            .order("id", { ascending: true }),
        );

        if (fetchError) {
          result.errors.push(`查询资产失败: ${fetchError.message}`);
        } else {
          for (const asset of assets) {
            if (!asset.file_url) continue;

            const filePath = storagePathFromUrl(asset.file_url);
            if (!filePath) continue; // 非本桶 URL（外链等），不检查

            try {
              const dir = filePath.split("/").slice(0, -1).join("/");
              const fileName = filePath.split("/").pop();
              const { data: fileExists, error: listError } =
                await supabase.storage
                  .from("assets")
                  .list(dir, { search: fileName });

              // 列目录失败 ≠ 文件不存在：跳过，避免瞬时故障误删行
              if (listError) {
                result.errors.push(
                  `检查文件 ${filePath} 失败: ${listError.message}`,
                );
                continue;
              }

              if (!fileExists || fileExists.length === 0) {
                result.orphanedRows.push({
                  id: asset.id,
                  file_url: asset.file_url,
                  reason: "Storage 中文件不存在",
                });

                const { error: deleteError } = await supabase
                  .from("asset")
                  .delete()
                  .eq("id", asset.id);

                if (deleteError) {
                  result.errors.push(
                    `删除记录 ${asset.id} 失败: ${deleteError.message}`,
                  );
                } else {
                  result.deletedRows.push(asset.id);
                }
              }
            } catch (err) {
              result.errors.push(
                `处理资产 ${asset.id} 时出错: ${
                  err instanceof Error ? err.message : "未知错误"
                }`,
              );
            }
          }
        }
      } catch (err) {
        result.errors.push(
          `清理数据库记录时出错: ${
            err instanceof Error ? err.message : "未知错误"
          }`,
        );
      }
    }

    // 2. 全桶清扫没有任何行引用的孤儿文件（全局对比，与 workspace 无关）
    if (wantFiles) {
      try {
        const storage = supabase.storage.from("assets");
        const [files, referencedPaths] = await Promise.all([
          listAllBucketFiles(storage),
          fetchReferencedPaths(supabase),
        ]);

        const now = Date.now();
        for (const file of files) {
          if (referencedPaths.has(file.path)) continue;

          // 新文件跳过：上传先于行落库，可能是进行中的上传
          if (file.createdAt) {
            const age = now - new Date(file.createdAt).getTime();
            if (Number.isFinite(age) && age < ORPHAN_FILE_MIN_AGE_MS) continue;
          }

          result.orphanedFiles.push({
            path: file.path,
            name: file.path.split("/").pop() ?? file.path,
          });

          const { error: deleteError } = await storage.remove([file.path]);
          if (deleteError) {
            result.errors.push(
              `删除文件 ${file.path} 失败: ${deleteError.message}`,
            );
          } else {
            result.deletedFiles.push(file.path);
          }
        }
      } catch (err) {
        result.errors.push(
          `清理存储文件时出错: ${
            err instanceof Error ? err.message : "未知错误"
          }`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        orphanedRowsFound: result.orphanedRows.length,
        orphanedFilesFound: result.orphanedFiles.length,
        rowsDeleted: result.deletedRows.length,
        filesDeleted: result.deletedFiles.length,
        errorsCount: result.errors.length,
      },
    });
  } catch (error) {
    console.error("清理操作失败:", error);
    await logErrorSafe({
      method: "POST",
      path: "/api/admin/clean",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
