import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: assetId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 解析请求体
    const body = await request.json();
    const { name, text_content, anchor_id, metadata } = body;

    // 首先检查该资产是否存在以及用户是否有权限
    const { data: asset, error: fetchError } = await supabase
      .from("asset")
      .select("id, created_by")
      .eq("id", assetId)
      .single();

    if (fetchError || !asset) {
      console.error("查询资产失败:", fetchError);
      return NextResponse.json({ error: "资源不存在" }, { status: 404 });
    }

    // 检查用户权限（只能修改自己的资产，或者是admin）
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isOwner = asset.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "无权限修改此资源" }, { status: 403 });
    }

    // 构建更新对象
    const updates: Record<string, unknown> = {};

    // 更新 name（如果提供）
    if (name !== undefined) {
      updates.name = name;
    }

    // 更新 text_content（如果提供）
    if (text_content !== undefined) {
      updates.text_content = text_content;
    }

    // 更新 anchor_id（如果提供）
    if (anchor_id !== undefined) {
      updates.anchor_id = anchor_id;
    }

    // 更新 metadata（合并而不是替换）
    if (metadata) {
      // 先获取当前的metadata
      const { data: currentAsset } = await supabase
        .from("asset")
        .select("metadata")
        .eq("id", assetId)
        .single();

      updates.metadata = {
        ...(currentAsset?.metadata || {}),
        ...metadata,
      };
    }

    // 执行更新
    const { data: updatedAsset, error: updateError } = await supabase
      .from("asset")
      .update(updates)
      .eq("id", assetId)
      .select(
        "id, name, file_type, file_url, text_content, anchor_id, metadata, workspace_id"
      )
      .single();

    if (updateError) {
      console.error("更新资源失败:", updateError);
      return NextResponse.json({ error: "更新资源失败" }, { status: 500 });
    }

    return NextResponse.json({ data: updatedAsset });
  } catch (error) {
    console.error("更新资源失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: assetId } = await params;

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 首先检查该资产是否存在以及用户是否有权限
    const { data: asset, error: fetchError } = await supabase
      .from("asset")
      .select("id, created_by, file_url")
      .eq("id", assetId)
      .single();

    if (fetchError || !asset) {
      console.error("查询资产失败:", fetchError);
      return NextResponse.json({ error: "资源不存在" }, { status: 404 });
    }

    // 检查用户权限（只能删除自己的资产，或者是admin）
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isOwner = asset.created_by === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "无权限删除此资源" }, { status: 403 });
    }

    // 如果有文件URL，尝试从storage中删除文件
    if (asset.file_url) {
      try {
        // 从 URL 中提取文件路径
        // URL 格式: https://{project}.supabase.co/storage/v1/object/public/assets/{workspace_id}/{filename}
        const url = new URL(asset.file_url);
        const pathMatch = url.pathname.match(
          /\/storage\/v1\/object\/public\/assets\/(.+)/
        );

        if (pathMatch) {
          // pathMatch[1] 是 {workspace_id}/{filename}，这正是我们需要的路径
          const filePath = pathMatch[1];
          console.log("尝试删除文件:", filePath);

          const { error: storageError } = await supabase.storage
            .from("assets")
            .remove([filePath]);

          if (storageError) {
            console.warn("删除存储文件失败:", storageError);
            // 不阻止删除数据库记录
          } else {
            console.log("文件删除成功");
          }
        }
      } catch (err) {
        console.warn("解析文件URL失败:", err);
        // 继续删除数据库记录
      }
    }

    // 从数据库中删除资产记录
    const { error: deleteError } = await supabase
      .from("asset")
      .delete()
      .eq("id", assetId);

    if (deleteError) {
      console.error("删除资源失败:", deleteError);
      return NextResponse.json({ error: "删除资源失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "资源已删除" });
  } catch (error) {
    console.error("删除资源失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
