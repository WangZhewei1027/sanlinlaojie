import { publicObjectUrl } from "@/lib/assets/urls";
import { loadActor } from "@/lib/content-model/access.server";
import { failure, requireSessionUserId } from "@/lib/content-model/http.server";
import { db } from "@/lib/db";
import { headObject } from "@/lib/storage/oss";
import { lockObjectKeys } from "@/lib/storage/retention.server";
import { findProbeKey, issueReceipt, resolveUploadScope } from "@/lib/upload/receipts.server";
import { NextResponse } from "next/server";

/**
 * 按内容 hash 查已存在的文件 URL，用于上传前去重。
 * 必须携带 organization_id 或 workspace_id（两者同时给出时合集必须属于该组织），
 * 调用者需是该团队的可编辑成员（团队角色从数据库读取，不信任参数）。只凭 hash 不能
 * 证明持有文件字节，所以只匹配调用者作为团队成员本就能读取的内容（findProbeKey）：
 * 本团队未归档素材的版本文件、调用者自己的有效上传回执；
 * 绝不返回其他团队的文件或他人未提交的上传。真实字节上传的去重仍走 /api/upload。
 * 命中时在对象 key 锁内复核仍可达并登记一张 asset_version 用途的租约，使后续
 * 版本写入之前文件不会被回收。
 * 未命中返回 { file_url: null }。
 */
export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash");
    const workspaceId = searchParams.get("workspace_id") || null;
    const organizationId = searchParams.get("organization_id") || null;
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return NextResponse.json({ error: "缺少 hash" }, { status: 400 });
    }
    if (!workspaceId && !organizationId) {
      return NextResponse.json({ error: "缺少 organization_id 或 workspace_id" }, { status: 400 });
    }

    const actor = await loadActor(db, userId);
    const scope = await resolveUploadScope(db, actor, { organizationId, workspaceId });
    const contentHash = hash.toLowerCase();
    const key = await findProbeKey(db, actor, scope.org, contentHash);
    if (!key) return NextResponse.json({ file_url: null });

    const exists = await db.transaction().execute(async (trx) => {
      await lockObjectKeys(trx, [key]);
      // Re-check reachability under the lock (the source may have changed), then existence.
      if ((await findProbeKey(trx, actor, scope.org, contentHash)) !== key) return false;
      if (!(await headObject(key))) return false;
      await issueReceipt(trx, {
        organizationId: scope.org.org.id,
        workspaceId: scope.workspaceId,
        userId: actor.userId,
        storageKey: key,
        contentHash,
        mimeType: null,
        sizeBytes: 0,
        uploadType: null,
        purpose: "asset_version",
        reused: true,
      });
      return true;
    });
    return NextResponse.json({ file_url: exists ? publicObjectUrl(key) : null });
  } catch (error) {
    return failure(error, { method: "GET", path: "/api/assets/by-hash", userId });
  }
}
