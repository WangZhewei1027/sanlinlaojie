import "server-only";
import { ASSET_PAYLOAD_SCHEMA_VERSION, type AssetVersionPayload, type ResourceInput, type ResourceRole } from "@/lib/content-model/contracts";
import { ensureAssetUse, loadOrgAccess, type Actor, type AssetIdentity, type OrgAccess } from "@/lib/content-model/access.server";
import { ContentError, invalid } from "@/lib/content-model/errors";
import type { Trx } from "@/lib/content-model/tx.server";
import { lockObjectKeys } from "@/lib/storage/retention.server";
import { loadCommitReceipts, markReceiptsConsumed } from "@/lib/upload/receipts.server";

interface ResourceRow {
  role: ResourceRole;
  ordinal: number;
  storage_key: string | null;
  external_url: string | null;
  content_hash: string | null;
  mime_type: string | null;
  size_bytes: number | null;
}

/**
 * Resolve resource inputs into rows. Managed keys only come from this actor's
 * unexpired receipts or from an existing version of the same organization
 * (source version ownership check). Object locks are taken before the rows
 * are written, so the collector cannot interleave.
 */
async function resolveResources(
  trx: Trx,
  actor: Actor,
  target: { assetId: string; organizationId: string; access?: OrgAccess },
  inputs: ResourceInput[],
): Promise<{ rows: ResourceRow[]; receiptIds: string[] }> {
  const organizationId = target.organizationId;
  const receiptIds = inputs.flatMap((input) => ("receiptId" in input ? [input.receiptId] : []));
  const fromVersionIds = [...new Set(inputs.flatMap((input) => ("fromVersionId" in input ? [input.fromVersionId] : [])))];

  const sources = fromVersionIds.length
    ? await trx
        .selectFrom("asset_version_resource as r")
        .innerJoin("asset_version as v", "v.id", "r.asset_version_id")
        .select(["r.asset_version_id", "r.role", "r.ordinal", "r.storage_key", "r.external_url", "r.content_hash", "r.mime_type", "r.size_bytes", "v.organization_id", "v.asset_id"])
        .where("r.asset_version_id", "in", fromVersionIds)
        .execute()
    : [];
  // Reusing another asset's files is a use of that team asset: same
  // organization, a writer of it, and the source still active (share lock).
  const checkedAssets = new Set<string>();
  let access = target.access ?? null;
  for (const versionId of fromVersionIds) {
    const owner = sources.find((s) => s.asset_version_id === versionId);
    if (!owner) throw invalid(`来源版本 ${versionId} 不存在或没有文件`);
    if (owner.organization_id !== organizationId) throw new ContentError("FORBIDDEN", "来源版本不属于该组织");
    if (checkedAssets.has(owner.asset_id) || owner.asset_id === target.assetId) continue;
    checkedAssets.add(owner.asset_id);
    access ??= await loadOrgAccess(trx, actor, organizationId);
    if (!access?.canRead || access.org.id !== organizationId) throw new ContentError("FORBIDDEN", "无权使用来源版本的文件");
    await ensureAssetUse(trx, actor, owner.asset_id, access);
  }

  // Lock every managed key first (sorted inside lockKeys), then validate leases.
  const receiptsPreview = receiptIds.length
    ? await trx.selectFrom("upload_receipt").select(["id", "storage_key"]).where("id", "in", receiptIds).execute()
    : [];
  const managedKeys = [
    ...receiptsPreview.map((r) => r.storage_key),
    ...sources.map((s) => s.storage_key).filter((k): k is string => !!k),
  ];
  await lockObjectKeys(trx, managedKeys);
  const receipts = await loadCommitReceipts(trx, actor.userId, organizationId, receiptIds);

  const rows = inputs.map((input): ResourceRow => {
    const ordinal = input.ordinal ?? 0;
    if ("receiptId" in input) {
      const receipt = receipts.get(input.receiptId)!;
      return {
        role: input.role,
        ordinal,
        storage_key: receipt.storage_key,
        external_url: null,
        content_hash: receipt.content_hash,
        mime_type: receipt.mime_type,
        size_bytes: receipt.size_bytes,
      };
    }
    if ("fromVersionId" in input) {
      const source = sources.find(
        (s) => s.asset_version_id === input.fromVersionId && s.role === input.fromRole && s.ordinal === (input.fromOrdinal ?? 0),
      );
      if (!source) throw invalid(`来源版本没有 ${input.fromRole}#${input.fromOrdinal ?? 0} 资源`);
      return {
        role: input.role,
        ordinal,
        storage_key: source.storage_key,
        external_url: source.external_url,
        content_hash: source.content_hash,
        mime_type: source.mime_type,
        size_bytes: source.size_bytes,
      };
    }
    return { role: input.role, ordinal, storage_key: null, external_url: input.externalUrl, content_hash: null, mime_type: null, size_bytes: null };
  });
  return { rows, receiptIds };
}

/**
 * Append an immutable version under the asset's row lock and advance the
 * current pointer. The caller has already locked the asset row FOR UPDATE and
 * checked write permission (or is creating the asset in this transaction).
 * `access` is the caller's resolved access to the asset's organization.
 */
export async function appendVersion(
  trx: Trx,
  actor: Actor,
  asset: Pick<AssetIdentity, "id" | "organization_id">,
  payload: AssetVersionPayload,
  inputs: ResourceInput[],
  opts: { sourceFingerprint?: string; actorIdForRow?: string | null; access?: OrgAccess } = {},
): Promise<{ versionId: string; versionNo: number }> {
  const { rows, receiptIds } = await resolveResources(trx, actor, { assetId: asset.id, organizationId: asset.organization_id, access: opts.access }, inputs);
  const last = await trx
    .selectFrom("asset_version")
    .select(({ fn }) => fn.max("version_no").as("max"))
    .where("asset_id", "=", asset.id)
    .executeTakeFirst();
  const versionNo = Number(last?.max ?? 0) + 1;
  const version = await trx
    .insertInto("asset_version")
    .values({
      asset_id: asset.id,
      organization_id: asset.organization_id,
      version_no: versionNo,
      payload_schema_version: ASSET_PAYLOAD_SCHEMA_VERSION,
      payload: JSON.stringify(payload),
      created_by: opts.actorIdForRow === undefined ? actor.userId : opts.actorIdForRow,
      source_fingerprint: opts.sourceFingerprint ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (rows.length)
    await trx
      .insertInto("asset_version_resource")
      .values(rows.map((row) => ({ ...row, asset_version_id: version.id })))
      .execute();
  await trx
    .updateTable("asset")
    .set((eb) => ({ current_version_id: version.id, lock_version: eb("lock_version", "+", 1) }))
    .where("id", "=", asset.id)
    .execute();
  await markReceiptsConsumed(trx, receiptIds);
  return { versionId: version.id, versionNo };
}
