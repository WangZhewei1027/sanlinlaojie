import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadActor, requireWorkspaceEdit } from "@/lib/content-model/access.server";
import { failure, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { publicObjectUrl } from "@/lib/assets/urls";
import { lockObjectKeys } from "@/lib/storage/retention.server";
import { headObject } from "@/lib/storage/oss";
import { findProbeKey, issueReceipt } from "@/lib/upload/receipts.server";

/**
 * 按内容 hash 查已存在的文件 URL，用于上传前去重。
 * 必须携带目标 workspace_id，且调用者需有该项目的编辑权限。只凭 hash 不能证明
 * 持有文件字节，所以只匹配调用者本就能读取/使用的内容（findProbeKey）：可在该
 * 项目使用的素材版本、可读项目中的旧行、或调用者自己的有效上传回执；绝不返回
 * 受限素材或他人未提交的上传。真实字节上传的去重仍走 /api/upload。
 * 命中时在对象 key 锁内复核仍可达并登记一张 legacy_asset 用途的租约，使后续
 * 旧行写入之前文件不会被回收；该租约不能用于创建 v2 版本。
 * 未命中返回 { file_url: null }。
 */
export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash");
    const workspaceId = searchParams.get("workspace_id");
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
      return NextResponse.json({ error: "缺少 hash" }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: "缺少 workspace_id" }, { status: 400 });
    }
    if (!isUuid(workspaceId)) return NextResponse.json({ error: "工作区不存在" }, { status: 404 });

    const actor = await loadActor(db, userId);
    const project = await requireWorkspaceEdit(db, actor, workspaceId);
    const key = await findProbeKey(db, actor, project, hash.toLowerCase());
    if (!key) return NextResponse.json({ file_url: null });

    const exists = await db.transaction().execute(async (trx) => {
      await lockObjectKeys(trx, [key]);
      // Re-check reachability under the lock (the source may have changed), then existence.
      if ((await findProbeKey(trx, actor, project, hash.toLowerCase())) !== key) return false;
      if (!(await headObject(key))) return false;
      await issueReceipt(trx, {
        organizationId: project.workspace.organization_id,
        workspaceId,
        userId: actor.userId,
        storageKey: key,
        contentHash: hash.toLowerCase(),
        mimeType: null,
        sizeBytes: 0,
        uploadType: null,
        purpose: "legacy_asset",
        reused: true,
      });
      return true;
    });
    return NextResponse.json({ file_url: exists ? publicObjectUrl(key) : null });
  } catch (error) {
    return failure(error, { method: "GET", path: "/api/assets/by-hash", userId });
  }
}
