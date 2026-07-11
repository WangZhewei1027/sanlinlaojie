import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOrgIds } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Gate an asset write (edit/delete). Requires super_admin, or `org.assets.write`
 * in EVERY organization the asset's workspaces belong to (an asset's
 * workspace_id is an array and may span workspaces/orgs — the strictest rule
 * prevents using a cross-org asset to sidestep a missing permission).
 */
async function authorizeAssetWrite(
  supabase: Supa,
  assetId: string,
  userId: string,
  method: string,
): Promise<
  | { ok: true; asset: { id: string; file_url?: string | null } }
  | { ok: false; response: NextResponse }
> {
  const { data: asset } = await supabase
    .from("asset")
    .select("id, file_url, workspace_id")
    .eq("id", assetId)
    .single();

  if (!asset) {
    return {
      ok: false,
      response: NextResponse.json({ error: "资源不存在" }, { status: 404 }),
    };
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (isSuperAdmin(userData?.role as string | undefined)) {
    return { ok: true, asset };
  }

  const workspaceIds = (asset.workspace_id as string[] | null) ?? [];
  const orgIds = await getWorkspaceOrgIds(supabase, workspaceIds);

  const deny = async (msg: string) => {
    await logError(supabase, {
      userId,
      method,
      path: `/api/assets/${assetId}`,
      status: 403,
      message: msg,
      context: { orgIds },
    });
    return {
      ok: false as const,
      response: NextResponse.json({ error: "权限不足" }, { status: 403 }),
    };
  };

  if (orgIds.length === 0) {
    return deny("权限不足: 资产无有效 org 归属");
  }

  const { data: memberships } = await supabase
    .from("organization_member")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("organization_id", orgIds);

  const roleByOrg = new Map(
    (memberships ?? []).map((m) => [m.organization_id as string, m.role as string]),
  );

  for (const orgId of orgIds) {
    if (!hasOrgPermission(roleByOrg.get(orgId), "org.assets.write")) {
      return deny("权限不足: org.assets.write");
    }
  }

  return { ok: true, asset };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id: assetId } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const auth = await authorizeAssetWrite(supabase, assetId, user.id, "PATCH");
    if (!auth.ok) return auth.response;

    // 解析请求体
    const body = await request.json();
    const {
      name,
      text_content,
      anchor_id,
      tag_ids,
      metadata,
      is_huge,
      file_url,
      config,
      location,
      content_hash,
    } = body;

    // 构建更新对象
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      updates.name = name;
    }

    if (text_content !== undefined) {
      updates.text_content = text_content;
    }

    if (anchor_id !== undefined) {
      updates.anchor_id = anchor_id;
    }

    if (tag_ids !== undefined) {
      updates.tag_ids = tag_ids;
    }

    if (is_huge !== undefined) {
      updates.is_huge = is_huge;
    }

    // 更新 config（合并而不是替换）
    if (config !== undefined) {
      const { data: currentAsset } = await supabase
        .from("asset")
        .select("config")
        .eq("id", assetId)
        .single();

      updates.config = {
        ...(currentAsset?.config || {}),
        ...config,
      };
    }

    if (file_url !== undefined) {
      updates.file_url = file_url;
    }

    if (content_hash !== undefined) {
      updates.content_hash = content_hash;
    }

    // 拖动素材落库：location 为 WKT（如 "POINT(lng lat)"），需与 metadata 坐标同步更新。
    if (location !== undefined) {
      updates.location = location;
    }

    // 更新 metadata（合并而不是替换）
    if (metadata) {
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

    const { data: updatedAsset, error: updateError } = await supabase
      .from("asset")
      .update(updates)
      .eq("id", assetId)
      .select(
        "id, name, file_type, file_url, text_content, anchor_id, tag_ids, metadata, workspace_id, is_huge, config",
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ data: updatedAsset });
  } catch (error) {
    console.error("更新资源失败:", error);
    await logError(supabase, {
      method: "PATCH",
      path: `/api/assets/${assetId}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id: assetId } = await params;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const auth = await authorizeAssetWrite(supabase, assetId, user.id, "DELETE");
    if (!auth.ok) return auth.response;
    const asset = auth.asset;

    // 如果有文件URL，尝试从storage中删除文件。
    // 但复制/hash 去重会让多个 asset 共用同一 file_url，只有在没有其他 asset
    // 仍引用该文件时才真正删除存储文件，避免误删共享文件。
    if (asset.file_url) {
      try {
        const url = new URL(asset.file_url);
        const pathMatch = url.pathname.match(
          /\/storage\/v1\/object\/public\/assets\/(.+)/,
        );

        if (pathMatch) {
          const { count: refCount } = await supabase
            .from("asset")
            .select("id", { count: "exact", head: true })
            .eq("file_url", asset.file_url)
            .neq("id", assetId);

          if (refCount && refCount > 0) {
            console.log(
              `文件仍被 ${refCount} 个其他资产引用，跳过存储删除: ${asset.file_url}`,
            );
          } else {
            const filePath = pathMatch[1];
            const { error: storageError } = await supabase.storage
              .from("assets")
              .remove([filePath]);

            if (storageError) {
              console.warn("删除存储文件失败:", storageError);
            }
          }
        }
      } catch (err) {
        console.warn("解析文件URL失败:", err);
      }
    }

    const { error: deleteError } = await supabase
      .from("asset")
      .delete()
      .eq("id", assetId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: "资源已删除" });
  } catch (error) {
    console.error("删除资源失败:", error);
    await logError(supabase, {
      method: "DELETE",
      path: `/api/assets/${assetId}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
