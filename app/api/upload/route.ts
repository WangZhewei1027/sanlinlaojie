import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import { loadActor, requireWorkspaceEdit, type Actor } from "@/lib/content-model/access.server";
import type { UploadPurpose, UploadResponse } from "@/lib/content-model/contracts";
import { ContentError } from "@/lib/content-model/errors";
import { failure, requireSessionUserId } from "@/lib/content-model/http.server";
import { isUuid } from "@/lib/content-model/input";
import { ASSETS_PREFIX, headObject, putObject } from "@/lib/storage/oss";
import { lockObjectKeys, releaseObjectsIfUnreferenced } from "@/lib/storage/retention.server";
import { publicObjectUrl } from "@/lib/assets/urls";
import { findReusableKey, issueReceipt, receiptDto, type ReceiptRow } from "@/lib/upload/receipts.server";
import { ALL_UPLOAD_TYPES, type UploadType } from "@/lib/upload/types";

// Media upload relay: the browser posts the (already compressed) file here and
// the server writes it to OSS.
//
// POST multipart/form-data { file, type?, workspace_id, purpose? }
//   → { url, contentHash, storagePath, data: UploadReceiptDto }
//     storagePath is null when identical bytes already exist in the target
//     organization (dedup: the existing object is reused under its object lock
//     and re-verified). The receipt binds actor, organization, key, hash and
//     purpose; it is the only way a v2 version may reference the object, and
//     while unexpired it keeps the collector away (upload lease). An upload is
//     not an asset: nothing is created or published here.
//   Requires edit rights on the project. Callers that still omit workspace_id
//   (legacy editor re-uploads) get the old behaviour without dedup/receipt,
//   only if they can edit at least one project.
// DELETE ?key=assets/<userId>/<name>
//   → compensation after a failed follow-up write: ends the caller's own
//     unconsumed leases on the key and hands it to the retention protocol
//     (actual deletion is deferred while object deletion is disabled).

// Hard cap, same as the old storage bucket; per-type limits are enforced
// client-side in lib/upload/config.ts.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PURPOSES: readonly UploadPurpose[] = ["asset_version", "anchor_reference", "legacy_asset"];

function newObjectKey(userId: string, fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${ASSETS_PREFIX}${userId}/${name}${ext ? `.${ext}` : ""}`;
}

async function canEditAnyProject(actor: Actor): Promise<boolean> {
  if (actor.superAdmin) return true;
  const row = await db
    .selectFrom("organization_member as m")
    .innerJoin("organization as o", "o.id", "m.organization_id")
    .select("m.id")
    .where("m.user_id", "=", actor.userId)
    .where("o.archived_at", "is", null)
    .where((eb) =>
      eb.or([
        eb("m.role", "in", ["owner", "admin"]),
        eb.and([
          eb("m.role", "=", "member"),
          eb.exists(
            eb
              .selectFrom("workspace_assignment as a")
              .innerJoin("workspace as w", "w.id", "a.workspace_id")
              .select("a.id")
              .whereRef("w.organization_id", "=", "m.organization_id")
              .where("a.user_id", "=", actor.userId)
              .where("a.role", "in", ["manager", "editor"]),
          ),
        ]),
      ]),
    )
    .limit(1)
    .executeTakeFirst();
  return !!row;
}

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const actor = await loadActor(db, userId);
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
    const requestedPurpose = form?.get("purpose");
    if (requestedPurpose && !PURPOSES.includes(requestedPurpose as UploadPurpose)) {
      return NextResponse.json({ error: "无效的上传用途" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(buffer).digest("hex");
    const mimeType = file.type || "application/octet-stream";

    if (typeof workspaceId !== "string" || !workspaceId) {
      if (!(await canEditAnyProject(actor))) throw new ContentError("FORBIDDEN", "需要项目编辑权限才能上传");
      const key = newObjectKey(actor.userId, file.name);
      const url = await putObject(key, buffer, { contentType: mimeType });
      const body: UploadResponse = { url, contentHash, storagePath: key };
      return NextResponse.json(body);
    }
    if (!isUuid(workspaceId)) return NextResponse.json({ error: "工作区不存在" }, { status: 404 });

    const project = await requireWorkspaceEdit(db, actor, workspaceId);
    if (project.org.content_model_state === "readonly")
      throw new ContentError("CONTENT_MODEL_READONLY", "组织正在切换内容模型，暂时只读");
    const organizationId = project.workspace.organization_id;
    const purpose: UploadPurpose =
      (requestedPurpose as UploadPurpose | null) ??
      (type === "anchor" ? "anchor_reference" : project.org.content_model_state === "v2" ? "asset_version" : "legacy_asset");
    const receiptInput = {
      organizationId,
      workspaceId,
      userId: actor.userId,
      contentHash,
      mimeType,
      sizeBytes: buffer.length,
      uploadType: typeof type === "string" && type ? type : null,
      purpose,
    };

    // Organization-scoped dedup. The reuse happens under the object lock the
    // collector also takes, and the object's existence is re-verified while
    // the lease is being written; a vanished object falls back to an upload.
    const existingKey = await findReusableKey(db, organizationId, contentHash);
    if (existingKey) {
      const reused = await db
        .transaction()
        .execute(async (trx): Promise<ReceiptRow | null> => {
          await lockObjectKeys(trx, [existingKey]);
          const receipt = await issueReceipt(trx, { ...receiptInput, storageKey: existingKey, reused: true });
          if (!(await headObject(existingKey))) throw new MissingObject();
          return receipt;
        })
        .catch((error: unknown) => {
          if (error instanceof MissingObject) return null;
          throw error;
        });
      if (reused) {
        const body: UploadResponse = { url: publicObjectUrl(existingKey), contentHash, storagePath: null, data: receiptDto(reused) };
        return NextResponse.json(body);
      }
    }

    const key = newObjectKey(actor.userId, file.name);
    await putObject(key, buffer, { contentType: mimeType });
    const receipt = await db.transaction().execute(async (trx) => {
      await lockObjectKeys(trx, [key]);
      return issueReceipt(trx, { ...receiptInput, storageKey: key, reused: false });
    });
    const body: UploadResponse = { url: publicObjectUrl(key), contentHash, storagePath: key, data: receiptDto(receipt) };
    return NextResponse.json(body);
  } catch (error) {
    return failure(error, { method: "POST", path: "/api/upload", userId });
  }
}

class MissingObject extends Error {}

export async function DELETE(request: Request) {
  let userId: string | null = null;
  try {
    userId = await requireSessionUserId();
    const key = new URL(request.url).searchParams.get("key") ?? "";
    if (!key.startsWith(`${ASSETS_PREFIX}${userId}/`) || key.includes("..")) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }
    // End only this caller's own unconsumed leases; anyone else's lease,
    // version resource or legacy row still protects the object.
    await db
      .updateTable("upload_receipt")
      .set({ expires_at: sql<Date>`now()` })
      .where("storage_key", "=", key)
      .where("created_by", "=", userId)
      .where("consumed_at", "is", null)
      .execute();
    const report = await releaseObjectsIfUnreferenced([key], { userId, method: "DELETE", path: "/api/upload" });
    if (report.kept.length) return NextResponse.json({ removed: false, reason: "referenced" });
    if (report.candidates.length) return NextResponse.json({ removed: false, reason: "deferred" });
    if (report.failed.length) return NextResponse.json({ error: "删除失败" }, { status: 500 });
    return NextResponse.json({ removed: report.removed.length > 0 });
  } catch (error) {
    return failure(error, { method: "DELETE", path: "/api/upload", userId });
  }
}
