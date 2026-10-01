import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { getUserContext, getWorkspaceOrgId } from "@/lib/permissions.server";
import { isSuperAdmin } from "@/lib/permissions";
import { logError } from "@/lib/log-error";
import { ASSETS_PREFIX, deleteObjects, mediaUrl, putObject } from "@/lib/storage/oss";
import { countFileReferences } from "@/lib/storage-cleanup.server";
import { ALL_UPLOAD_TYPES, type UploadType } from "@/lib/upload/types";

// Media upload relay: the browser posts the (already compressed) file here and
// the server writes it to OSS. Replaces the direct-to-Supabase-Storage upload.
//
// POST multipart/form-data { file, type?, workspace_id? }
//   → { url, contentHash, storagePath }   storagePath is null when an identical
//     file already exists in the target organization (content-hash dedup; the
//     existing URL is reused and nothing is uploaded).
// DELETE ?key=assets/<userId>/<name>
//   → compensating cleanup when the follow-up DB insert failed. Only the
//     uploader's own objects, and only while no asset row references them.

// Hard cap, same as the old storage bucket; per-type limits are enforced
// client-side in lib/upload/config.ts.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function newObjectKey(userId: string, fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${ASSETS_PREFIX}${userId}/${name}${ext ? `.${ext}` : ""}`;
}

/** Existing file_url with this content hash inside the workspace's organization. */
async function findExistingByHash(
  hash: string,
  workspaceId: string,
): Promise<string | null> {
  const orgId = await getWorkspaceOrgId(workspaceId);
  if (!orgId) return null;
  const wsRows = await db
    .selectFrom("workspace")
    .select("id")
    .where("organization_id", "=", orgId)
    .execute();
  const orgWorkspaceIds = wsRows.map((w) => w.id);
  if (orgWorkspaceIds.length === 0) return null;
  const row = await db
    .selectFrom("asset")
    .select("file_url")
    .where("content_hash", "=", hash)
    .where("file_url", "is not", null)
    .where("workspace_id", "&&", orgWorkspaceIds)
    .limit(1)
    .executeTakeFirst();
  return row?.file_url ?? null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少文件" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `文件大小超过限制 (${MAX_UPLOAD_BYTES / 1024 / 1024}MB)` },
        { status: 413 },
      );
    }
    const type = form?.get("type");
    if (type && !ALL_UPLOAD_TYPES.includes(type as UploadType)) {
      return NextResponse.json({ error: "无效的文件类型" }, { status: 400 });
    }
    const workspaceId = form?.get("workspace_id");

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(buffer).digest("hex");

    // 组织内去重：目标 workspace 所属组织里已有相同内容则直接复用
    if (typeof workspaceId === "string" && workspaceId) {
      const orgId = await getWorkspaceOrgId(workspaceId);
      if (!orgId) {
        return NextResponse.json({ error: "工作区不存在" }, { status: 404 });
      }
      const { globalRole, orgRole } = await getUserContext(user.id, orgId);
      if (!isSuperAdmin(globalRole ?? undefined) && !orgRole) {
        return NextResponse.json({ error: "权限不足" }, { status: 403 });
      }
      const existing = await findExistingByHash(contentHash, workspaceId);
      if (existing) {
        return NextResponse.json({ url: existing, contentHash, storagePath: null });
      }
    }

    const key = newObjectKey(user.id, file.name);
    const url = await putObject(key, buffer, {
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url, contentHash, storagePath: key });
  } catch (error) {
    console.error("上传失败:", error);
    await logError({
      userId: user.id,
      method: "POST",
      path: "/api/upload",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith(`${ASSETS_PREFIX}${user.id}/`) || key.includes("..")) {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  try {
    // 并发去重命中可能已让新行引用该对象，仍被引用则保留
    if ((await countFileReferences(mediaUrl(key))) > 0) {
      return NextResponse.json({ removed: false, reason: "referenced" });
    }
    await deleteObjects([key]);
    return NextResponse.json({ removed: true });
  } catch (error) {
    await logError({
      userId: user.id,
      method: "DELETE",
      path: "/api/upload",
      status: 500,
      message: error instanceof Error ? error.message : String(error),
      context: { key },
    });
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
