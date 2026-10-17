import { publicObjectUrl } from "@/lib/assets/urls";
import { loadActor } from "@/lib/content-model/access.server";
import type { UploadPurpose, UploadResponse } from "@/lib/content-model/contracts";
import { ContentError } from "@/lib/content-model/errors";
import { failure, requireSessionUserId } from "@/lib/content-model/http.server";
import { db, sql } from "@/lib/db";
import { ASSETS_PREFIX, headObject, putObject } from "@/lib/storage/oss";
import { lockObjectKeys, releaseObjectsIfUnreferenced } from "@/lib/storage/retention.server";
import { findReusableKey, issueReceipt, receiptDto, resolveUploadScope, type ReceiptRow } from "@/lib/upload/receipts.server";
import { ALL_UPLOAD_TYPES, type UploadType } from "@/lib/upload/types";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

// Media upload relay: the browser posts the (already compressed) file here and
// the server writes it to OSS.
//
// POST multipart/form-data { file, type?, organization_id?, workspace_id?, purpose? }
//   → { url, contentHash, storagePath, data: UploadReceiptDto }
//     storagePath is null when identical bytes already exist in the target
//     organization (dedup: the existing object is reused under its object lock
//     and re-verified). The receipt binds actor, organization, key, hash and
//     purpose; it is the only way a v2 version may reference the object, and
//     while unexpired it keeps the collector away (upload lease). An upload is
//     not an asset: nothing is created or published here.
//   organization_id and workspace_id only select the team: the caller must be
//   a team writer (read from the database); a workspace_id must be an open
//   collection of that organization. No collection is needed for team
//   content. Every upload must name its team or collection.
// DELETE ?key=assets/<userId>/<name>
//   → compensation after a failed follow-up write: ends the caller's own
//     unconsumed leases on the key and hands it to the retention protocol
//     (actual deletion is deferred while object deletion is disabled).

// Hard cap, same as the old storage bucket; per-type limits are enforced
// client-side in lib/upload/config.ts.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PURPOSES: readonly UploadPurpose[] = ["asset_version"];

function newObjectKey(userId: string, fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${ASSETS_PREFIX}${userId}/${name}${ext ? `.${ext}` : ""}`;
}

function formText(form: FormData | null, name: string): string | null {
  const value = form?.get(name);
  return typeof value === "string" && value ? value : null;
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
    const organizationId = formText(form, "organization_id");
    const workspaceId = formText(form, "workspace_id");
    const requestedPurpose = form?.get("purpose");
    if (requestedPurpose && !PURPOSES.includes(requestedPurpose as UploadPurpose)) {
      return NextResponse.json({ error: "无效的上传用途" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(buffer).digest("hex");
    const mimeType = file.type || "application/octet-stream";

    if (!organizationId && !workspaceId) throw new ContentError("VALIDATION_FAILED", "需要指定团队或地图合集");

    const scope = await resolveUploadScope(db, actor, { organizationId, workspaceId });
    const purpose: UploadPurpose =
      (requestedPurpose as UploadPurpose | null) ??
      "asset_version";
    const receiptInput = {
      organizationId: scope.org.org.id,
      workspaceId: scope.workspaceId,
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
    const existingKey = await findReusableKey(db, scope.org.org.id, contentHash);
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
    // version resource or retention hold still protects the object.
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
