import { trySyncAnchor, referenceUrl } from "@/lib/anchor/embedding.server";
import { validateAnchorLink } from "@/lib/anchor/access.server";
import { MatchingError, finiteNumber } from "@/lib/anchor-matching";
import { NextResponse } from "next/server";
import type { Updateable } from "kysely";
import { db, type DB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { getWorkspaceOrgIds } from "@/lib/permissions.server";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";
import { removeStorageFileIfUnreferenced } from "@/lib/storage-cleanup.server";

interface AssetRow {
  id: string;
  file_type: string;
  workspace_id: string[] | null;
  file_url: string | null;
  metadata: Record<string, unknown> | null;
}

// PATCH 返回的列（与原 PostgREST select 列表一致）
const PATCH_RETURN_COLUMNS = [
  "id",
  "name",
  "file_type",
  "file_url",
  "text_content",
  "anchor_id",
  "tag_ids",
  "metadata",
  "workspace_id",
  "is_huge",
  "config",
] as const;

/**
 * Gate an asset write (edit/delete). Requires super_admin, or `org.assets.write`
 * in EVERY organization the asset's workspaces belong to (an asset's
 * workspace_id is an array and may span workspaces/orgs — the strictest rule
 * prevents using a cross-org asset to sidestep a missing permission).
 */
async function authorizeAssetWrite(
  assetId: string,
  userId: string,
  method: string,
): Promise<
  { ok: true; asset: AssetRow } | { ok: false; response: NextResponse }
> {
  const row = await db
    .selectFrom("asset")
    .select(["id", "file_type", "file_url", "metadata", "workspace_id"])
    .where("id", "=", assetId)
    .executeTakeFirst();

  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "资源不存在" }, { status: 404 }),
    };
  }

  // metadata 为 jsonb，读出来已是解析后的对象
  const asset: AssetRow = {
    ...row,
    metadata: row.metadata as Record<string, unknown> | null,
  };

  const userData = await db
    .selectFrom("users")
    .select("role")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (isSuperAdmin(userData?.role)) {
    return { ok: true, asset };
  }

  const workspaceIds = asset.workspace_id ?? [];
  const orgIds = await getWorkspaceOrgIds(workspaceIds);

  const deny = async (msg: string) => {
    await logError({
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

  const memberships = await db
    .selectFrom("organization_member")
    .select(["organization_id", "role"])
    .where("user_id", "=", userId)
    .where("organization_id", "in", orgIds)
    .execute();

  const roleByOrg = new Map(
    memberships.map((m) => [m.organization_id, m.role] as const),
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
  const { id: assetId } = await params;
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const auth = await authorizeAssetWrite(assetId, user.id, "PATCH");
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

    await validateAnchorLink(anchor_id, auth.asset.file_type, auth.asset.workspace_id ?? [], assetId);
    if (auth.asset.file_type === "anchor") {
      if (name !== undefined && (typeof name !== "string" || !name.trim())) throw new MatchingError("匹配点必须输入名称");
      if (file_url !== undefined) referenceUrl(file_url);
      if (metadata && (metadata.latitude !== undefined || metadata.longitude !== undefined)) {
        finiteNumber(metadata.latitude ?? auth.asset.metadata?.latitude, -90, 90, "latitude");
        finiteNumber(metadata.longitude ?? auth.asset.metadata?.longitude, -180, 180, "longitude");
      }
    }

    // 构建更新对象
    const updates: Updateable<DB["asset"]> = {};

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

    // 更新 config（合并而不是替换）；jsonb 按字符串写入
    if (config !== undefined) {
      const currentAsset = await db
        .selectFrom("asset")
        .select("config")
        .where("id", "=", assetId)
        .executeTakeFirst();

      updates.config = JSON.stringify({
        ...((currentAsset?.config as Record<string, unknown> | null) || {}),
        ...config,
      });
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

    // 更新 metadata（合并而不是替换）；jsonb 按字符串写入
    if (metadata) {
      const currentAsset = await db
        .selectFrom("asset")
        .select("metadata")
        .where("id", "=", assetId)
        .executeTakeFirst();

      updates.metadata = JSON.stringify({
        ...((currentAsset?.metadata as Record<string, unknown> | null) || {}),
        ...metadata,
      });
    }

    // Keep spatial matching in sync with coordinates edited in the form.
    if (auth.asset.file_type === "anchor" && metadata && (metadata.latitude !== undefined || metadata.longitude !== undefined)) {
      updates.location = `POINT(${metadata.longitude ?? auth.asset.metadata?.longitude} ${metadata.latitude ?? auth.asset.metadata?.latitude})`;
    }

    // 没有任何可更新字段时不下发 UPDATE（空 SET 是非法 SQL），直接回读当前行
    const updatedAsset =
      Object.keys(updates).length > 0
        ? await db
            .updateTable("asset")
            .set(updates)
            .where("id", "=", assetId)
            .returning(PATCH_RETURN_COLUMNS)
            .executeTakeFirstOrThrow()
        : await db
            .selectFrom("asset")
            .select(PATCH_RETURN_COLUMNS)
            .where("id", "=", assetId)
            .executeTakeFirstOrThrow();

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
      await removeStorageFileIfUnreferenced(url, {
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
    await logError({
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
  const { id: assetId } = await params;
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const auth = await authorizeAssetWrite(assetId, user.id, "DELETE");
    if (!auth.ok) return auth.response;
    const asset = auth.asset;

    // 先删行、后删文件：行删掉后再按引用计数清理存储（复制/hash 去重会让多个
    // asset 共用同一文件），失败方向只留孤儿文件（由 admin/clean 全局清扫兜底），
    // 不会出现"行还在但文件没了"的死链。
    await db.deleteFrom("asset").where("id", "=", assetId).execute();

    const checkinUrl = asset.metadata?.checkin_url;
    const fileUrls = new Set(
      [asset.file_url, typeof checkinUrl === "string" ? checkinUrl : null].filter(
        (u): u is string => !!u,
      ),
    );
    for (const url of fileUrls) {
      await removeStorageFileIfUnreferenced(url, {
        userId: user.id,
        method: "DELETE",
        path: `/api/assets/${assetId}`,
      });
    }

    return NextResponse.json({ success: true, message: "资源已删除" });
  } catch (error) {
    if (error instanceof MatchingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("删除资源失败:", error);
    await logError({
      method: "DELETE",
      path: `/api/assets/${assetId}`,
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
