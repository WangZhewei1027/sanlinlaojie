import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      // Check org-level role for cleanup permission
      // super_admin or org owner/admin can run cleanup
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { workspaceId, action } = body;
    // action: "clean-rows" | "clean-files" | "both"

    if (!workspaceId) {
      return NextResponse.json({ error: "请选择工作空间" }, { status: 400 });
    }

    const result: CleanResult = {
      orphanedRows: [],
      orphanedFiles: [],
      deletedRows: [],
      deletedFiles: [],
      errors: [],
    };

    // 1. 检查并清理数据库中文件不存在的记录
    if (action === "clean-rows" || action === "both") {
      try {
        // 获取该工作空间下所有有 file_url 的资产
        const { data: assets, error: fetchError } = await supabase
          .from("asset")
          .select("id, file_url")
          .contains("workspace_id", [workspaceId])
          .not("file_url", "is", null);

        if (fetchError) {
          result.errors.push(`查询资产失败: ${fetchError.message}`);
        } else if (assets) {
          // 检查每个文件是否在 storage 中存在
          for (const asset of assets) {
            if (!asset.file_url) continue;

            try {
              const url = new URL(asset.file_url);
              const pathMatch = url.pathname.match(
                /\/storage\/v1\/object\/public\/assets\/(.+)/,
              );

              if (pathMatch) {
                const filePath = pathMatch[1];

                // 检查文件是否存在
                const { data: fileExists } = await supabase.storage
                  .from("assets")
                  .list(filePath.split("/").slice(0, -1).join("/"), {
                    search: filePath.split("/").pop(),
                  });

                if (!fileExists || fileExists.length === 0) {
                  result.orphanedRows.push({
                    id: asset.id,
                    file_url: asset.file_url,
                    reason: "Storage 中文件不存在",
                  });

                  // 删除数据库记录
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

    // 2. 检查并清理 bucket 中数据库没有记录的文件
    if (action === "clean-files" || action === "both") {
      try {
        // 列出该工作空间文件夹下的所有文件
        const { data: files, error: listError } = await supabase.storage
          .from("assets")
          .list(workspaceId, {
            limit: 1000,
            sortBy: { column: "name", order: "asc" },
          });

        if (listError) {
          result.errors.push(`列出文件失败: ${listError.message}`);
        } else if (files) {
          // 获取数据库中所有该工作空间的文件记录
          const { data: assets } = await supabase
            .from("asset")
            .select("file_url")
            .contains("workspace_id", [workspaceId])
            .not("file_url", "is", null);

          const fileUrlSet = new Set(
            assets?.map((a) => a.file_url).filter(Boolean) || [],
          );

          // 检查每个文件是否在数据库中有记录
          for (const file of files) {
            // 跳过文件夹
            if (!file.name || file.name.endsWith("/")) continue;

            const filePath = `${workspaceId}/${file.name}`;
            const fullUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/${filePath}`;

            if (!fileUrlSet.has(fullUrl)) {
              result.orphanedFiles.push({
                path: filePath,
                name: file.name,
              });

              // 删除文件
              const { error: deleteError } = await supabase.storage
                .from("assets")
                .remove([filePath]);

              if (deleteError) {
                result.errors.push(
                  `删除文件 ${filePath} 失败: ${deleteError.message}`,
                );
              } else {
                result.deletedFiles.push(filePath);
              }
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
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
