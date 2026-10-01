import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getUserContext } from "@/lib/permissions.server";
import { isSuperAdmin } from "@/lib/permissions";
import { logErrorSafe } from "@/lib/log-error";
import { storagePathFromUrl } from "@/lib/storage-cleanup.server";
import {
  ASSETS_PREFIX,
  deleteObjects,
  headObject,
  listObjects,
} from "@/lib/storage/oss";

/**
 * 存储/数据库一致性清扫（仅 super_admin）：
 *
 * - clean-rows：按 workspace 扫描资产行，删除其 file_url 指向的存储对象已不存在
 *   的死链行（需要 workspaceId）。
 * - clean-files：遍历 OSS 上 assets/ 前缀下的全部对象，对比全表引用（file_url +
 *   metadata.checkin_url），删除没有任何行引用的孤儿文件。这是所有删除路径
 *   "先删行、后删文件，存储失败不阻断"策略的兜底清扫，必须全局对比——
 *   内容 hash 去重会让文件被任意 workspace/组织的资产共享，按单 workspace
 *   对比会误删共享文件。刚上传、行可能尚未落库的新文件（24 小时内）跳过。
 */

const ORPHAN_FILE_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** 每批删除的对象数（OSS 单次 deleteMulti 上限），按批记录成功/失败 */
const DELETE_BATCH_SIZE = 1000;

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

/** 全表引用集合：所有 file_url 与 metadata.checkin_url 能解析出的对象 key。 */
async function fetchReferencedPaths(): Promise<Set<string>> {
  const rows = await db
    .selectFrom("asset")
    .select([
      "file_url",
      sql<string | null>`metadata->>'checkin_url'`.as("checkin_url"),
    ])
    .execute();

  const referenced = new Set<string>();
  for (const row of rows) {
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
    // 验证用户权限
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { globalRole } = await getUserContext(user.id);

    if (!isSuperAdmin(globalRole)) {
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
        let assets: { id: string; file_url: string | null }[] = [];
        try {
          assets = await db
            .selectFrom("asset")
            .select(["id", "file_url"])
            .where(sql<boolean>`workspace_id @> array[${workspaceId}::uuid]`)
            .where("file_url", "is not", null)
            .orderBy("id", "asc")
            .execute();
        } catch (fetchError) {
          result.errors.push(
            `查询资产失败: ${
              fetchError instanceof Error ? fetchError.message : "未知错误"
            }`,
          );
        }

        for (const asset of assets) {
          if (!asset.file_url) continue;

          const filePath = storagePathFromUrl(asset.file_url);
          if (!filePath) continue; // 非本站 OSS URL（外链等），不检查

          try {
            // headObject 仅在对象确实不存在时返回 null，其余故障抛错
            let exists: boolean;
            try {
              exists = (await headObject(filePath)) !== null;
            } catch (headError) {
              // 查询失败 ≠ 文件不存在：跳过，避免瞬时故障误删行
              result.errors.push(
                `检查文件 ${filePath} 失败: ${
                  headError instanceof Error ? headError.message : "未知错误"
                }`,
              );
              continue;
            }

            if (!exists) {
              result.orphanedRows.push({
                id: asset.id,
                file_url: asset.file_url,
                reason: "Storage 中文件不存在",
              });

              try {
                await db.deleteFrom("asset").where("id", "=", asset.id).execute();
                result.deletedRows.push(asset.id);
              } catch (deleteError) {
                result.errors.push(
                  `删除记录 ${asset.id} 失败: ${
                    deleteError instanceof Error
                      ? deleteError.message
                      : "未知错误"
                  }`,
                );
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
        // 先列对象、后取引用：引用快照越接近删除时刻，列表期间新落库的行被漏判的窗口越小
        const files: { key: string; lastModified: Date }[] = [];
        for await (const obj of listObjects(ASSETS_PREFIX)) {
          files.push({ key: obj.key, lastModified: obj.lastModified });
        }
        const referencedPaths = await fetchReferencedPaths();

        const now = Date.now();
        const orphanKeys: string[] = [];
        for (const file of files) {
          if (referencedPaths.has(file.key)) continue;

          // 新文件跳过：上传先于行落库，可能是进行中的上传
          //（对象只写一次，lastModified 即上传时间）
          const age = now - file.lastModified.getTime();
          if (Number.isFinite(age) && age < ORPHAN_FILE_MIN_AGE_MS) continue;

          result.orphanedFiles.push({
            path: file.key,
            name: file.key.split("/").pop() ?? file.key,
          });
          orphanKeys.push(file.key);
        }

        for (let i = 0; i < orphanKeys.length; i += DELETE_BATCH_SIZE) {
          const batch = orphanKeys.slice(i, i + DELETE_BATCH_SIZE);
          try {
            await deleteObjects(batch);
            result.deletedFiles.push(...batch);
          } catch (deleteError) {
            const message =
              deleteError instanceof Error ? deleteError.message : "未知错误";
            for (const key of batch) {
              result.errors.push(`删除文件 ${key} 失败: ${message}`);
            }
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
