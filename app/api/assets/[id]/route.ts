import { trySyncAnchor, referenceUrl } from "@/lib/anchor/embedding.server";
import { validateAnchorLink } from "@/lib/anchor/access.server";
import { MatchingError, finiteNumber } from "@/lib/anchor-matching";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOrgIds } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";
import { removeStorageFileIfUnreferenced } from "@/lib/storage-cleanup.server";

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
  | {
      ok: true;
      asset: {
        id: string;
        file_type: string;
        workspace_id: string[] | null;
        file_url?: string | null;
        metadata?: Record<string, unknown> | null;
      };
    }
  | { ok: false; response: NextResponse }
> {
  const { data: asset } = await supabase
    .from("asset")
    .select("id, file_type, file_url, metadata, workspace_id")
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

export const maxDuration = 60;

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

    await validateAnchorLink(supabase, anchor_id, auth.asset.file_type, auth.asset.workspace_id ?? [], assetId);
    if (auth.asset.file_type === "anchor") {
      if (name !== undefined && (typeof name !== "string" || !name.trim())) throw new MatchingError("匹配点必须输入名称");
      if (file_url !== undefined) referenceUrl(file_url);
      if (metadata && (metadata.latitude !== undefined || metadata.longitude !== undefined)) {
        finiteNumber(metadata.latitude ?? auth.asset.metadata?.latitude, -90, 90, "latitude");
        finiteNumber(metadata.longitude ?? auth.asset.metadata?.longitude, -180, 180, "longitude");
      }
    }

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

    // Keep spatial matching in sync with coordinates edited in the form.
    if (auth.asset.file_type === "anchor" && metadata && (metadata.latitude !== undefined || metadata.longitude !== undefined)) {
      updates.location = `POINT(${metadata.longitude ?? auth.asset.metadata?.longitude} ${metadata.latitude ?? auth.asset.metadata?.latitude})`;
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

    // 换文件（编辑器重传图片/打卡图）后回收旧文件：行已指向新 URL，旧 URL 若再无
    // 任何行引用则删除存储对象，避免旧文件永久残留。
    const staleUrls = new Set<string>();
    const oldFileUrl = auth.asset.file_url;
    if (file_url !== undefined && oldFileUrl && file_url !== oldFileUrl) {
      staleUrls.add(oldFileUrl);
    }
    const oldCheckinUrl = auth.asset.metadata?.checkin_url;
    const newCheckinUrl = metadata?.checkin_url;
    if (
      newCheckinUrl !== undefined &&
      typeof oldCheckinUrl === "string" &&
      oldCheckinUrl &&
      newCheckinUrl !== oldCheckinUrl
    ) {
      staleUrls.add(oldCheckinUrl);
    }
    for (const url of staleUrls) {
      await removeStorageFileIfUnreferenced(supabase, url, {
        userId: user.id,
        method: "PATCH",
        path: `/api/assets/${assetId}`,
      });
    }

    if (file_url !== undefined && file_url !== auth.asset.file_url) await trySyncAnchor(updatedAsset);
    return NextResponse.json({ data: updatedAsset });
  } catch (error) {
    if (error instanceof MatchingError) return NextResponse.json({ error: error.message }, { status: error.status });
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

    // 先删行、后删文件：行删掉后再按引用计数清理存储（复制/hash 去重会让多个
    // asset 共用同一文件），失败方向只留孤儿文件（由 admin/clean 全局清扫兜底），
    // 不会出现"行还在但文件没了"的死链。
    const { error: deleteError } = await supabase
      .from("asset")
      .delete()
      .eq("id", assetId);

    if (deleteError) {
      throw deleteError;
    }

    const checkinUrl = asset.metadata?.checkin_url;
    const fileUrls = new Set(
      [asset.file_url, typeof checkinUrl === "string" ? checkinUrl : null].filter(
        (u): u is string => !!u,
      ),
    );
    for (const url of fileUrls) {
      await removeStorageFileIfUnreferenced(supabase, url, {
        userId: user.id,
        method: "DELETE",
        path: `/api/assets/${assetId}`,
      });
    }

    return NextResponse.json({ success: true, message: "资源已删除" });
  } catch (error) {
    if (error instanceof MatchingError) return NextResponse.json({ error: error.message }, { status: error.status });
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
