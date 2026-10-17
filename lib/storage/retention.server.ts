import "server-only";
import { db, sql } from "@/lib/db";
import { lockKeys, objectLockKey, type Executor, type Trx } from "@/lib/content-model/tx.server";
import { logError } from "@/lib/log-error";
import { ASSETS_PREFIX, deleteObjects, mediaKeyFromUrl } from "./oss";
import { MEDIA_BASE_URL, mediaKeysInText } from "./public-url";

/**
 * Managed-object retention (plan §8.5).
 *
 * One protocol for every path that reuses, commits or deletes an uploaded
 * object: take the transaction-scoped advisory lock `object-key:<key>`, then
 * decide. Reusers (upload dedup, version commit) hold the lock while they
 * write the lease/resource row; the collector holds it across the final
 * reference check and the actual delete. A plain re-count before deleting is
 * not enough and is never used.
 *
 * A key is protected while anything references it or a sibling derived file
 * (`x.webm` ↔ `x.m4a`, the mini-program's audio convention): immutable version
 * resources, legacy asset file_url / checkin_url / URLs inside legacy JSON,
 * anchor reference images, and unexpired upload receipts (in-flight uploads).
 *
 * Actual object deletion is disabled unless app_config
 * `managed_object_deletion` = {"enabled": true}; until then every path only
 * reports candidates (migration window).
 */

export const UPLOAD_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const DELETION_CONFIG_KEY = "managed_object_deletion";

export async function isObjectDeletionEnabled(exec: Executor = db): Promise<boolean> {
  const row = await exec.selectFrom("app_config").select("value").where("key", "=", DELETION_CONFIG_KEY).executeTakeFirst();
  const value = row?.value;
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).enabled === true;
}

/** Derived compatibility files share the protection of their source and vice versa. */
export function relatedKeys(key: string): string[] {
  if (/\.webm$/i.test(key)) return [key, key.replace(/\.webm$/i, ".m4a")];
  if (/\.m4a$/i.test(key)) return [key, key.replace(/\.m4a$/i, ".webm")];
  return [key];
}

/** URL spellings under which legacy rows may store a key. */
function urlForms(key: string): string[] {
  if (!MEDIA_BASE_URL) return [];
  const encoded = `${MEDIA_BASE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const raw = `${MEDIA_BASE_URL}/${key}`;
  return encoded === raw ? [raw] : [encoded, raw];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Exhaustive check for one key (run under its object lock before deleting). */
export async function isKeyProtected(exec: Executor, key: string): Promise<boolean> {
  const keys = relatedKeys(key);
  const urls = keys.flatMap(urlForms);

  const resource = await exec
    .selectFrom("asset_version_resource")
    .select("asset_version_id")
    .where("storage_key", "in", keys)
    .limit(1)
    .executeTakeFirst();
  if (resource) return true;

  const receipt = await exec
    .selectFrom("upload_receipt")
    .select("id")
    .where("storage_key", "in", keys)
    .where("expires_at", ">", sql<Date>`clock_timestamp()`)
    .limit(1)
    .executeTakeFirst();
  if (receipt) return true;

  const patternsForPayload = keys.map((k) => `%${escapeLike(k)}%`);
  const payload = await exec
    .selectFrom("asset_version")
    .select("id")
    .where((eb) => eb.or(patternsForPayload.map((p) => eb(sql<string>`payload::text`, "like", p))))
    .limit(1)
    .executeTakeFirst();
  if (payload) return true;

  if (urls.length) {
    const anchor = await exec.selectFrom("anchor_embedding").select("anchor_id").where("image_url", "in", urls).limit(1).executeTakeFirst();
    if (anchor) return true;
  }

  // Legacy rows: direct columns plus any mention inside JSON/text (link
  // previews, shop check-in images, hand-edited metadata).
  const patterns = keys.map((k) => `%${escapeLike(k)}%`);
  const legacy = await exec
    .selectFrom("asset")
    .select("id")
    .where((eb) =>
      eb.or([
        ...(urls.length ? [eb("file_url", "in", urls), eb(sql<string>`metadata->>'checkin_url'`, "in", urls)] : []),
        ...patterns.flatMap((p) => [
          eb(sql<string>`coalesce(file_url, '')`, "like", p),
          eb(sql<string>`coalesce(metadata::text, '')`, "like", p),
          eb(sql<string>`coalesce(config::text, '')`, "like", p),
          eb(sql<string>`coalesce(text_content, '')`, "like", p),
        ]),
      ]),
    )
    .limit(1)
    .executeTakeFirst();
  return !!legacy;
}

/**
 * Hold the object locks for `keys` in this transaction (reuse/commit and
 * collector side alike). Derived compatibility files share the lock domain of
 * their source, so reuse of `x.webm` serializes with collection of `x.m4a`.
 */
export async function lockObjectKeys(trx: Trx, keys: Iterable<string>): Promise<void> {
  await lockKeys(trx, [...keys].flatMap(relatedKeys).map(objectLockKey));
}

export type RetentionOutcome = "removed" | "kept" | "candidate" | "failed" | "skipped";

export interface RetentionReport {
  removed: string[];
  kept: string[];
  candidates: string[];
  failed: string[];
  skipped: string[];
  deletionEnabled: boolean;
}

/**
 * Collector side: for each key, lock → exhaustive re-check → delete (or only
 * report while deletion is disabled). Never throws for storage failures.
 */
export async function releaseObjectsIfUnreferenced(
  keys: Iterable<string>,
  ctx: { userId?: string | null; method: string; path: string },
): Promise<RetentionReport> {
  const deletionEnabled = await isObjectDeletionEnabled();
  const report: RetentionReport = { removed: [], kept: [], candidates: [], failed: [], skipped: [], deletionEnabled };
  for (const key of new Set(keys)) {
    if (!key.startsWith(ASSETS_PREFIX) || key.includes("..")) {
      report.skipped.push(key);
      continue;
    }
    let outcome: RetentionOutcome;
    try {
      outcome = await db.transaction().execute(async (trx) => {
        await lockObjectKeys(trx, [key]);
        if (await isKeyProtected(trx, key)) return "kept" as const;
        if (!deletionEnabled) return "candidate" as const;
        // Still holding the lock: no reuser can commit this key meanwhile.
        await deleteObjects([key]);
        return "removed" as const;
      });
    } catch (error) {
      outcome = "failed";
      await logError({
        userId: ctx.userId ?? null,
        method: ctx.method,
        path: ctx.path,
        status: 500,
        message: `storage release failed: ${error instanceof Error ? error.message : String(error)}`,
        context: { key },
      });
    }
    ({ removed: report.removed, kept: report.kept, candidate: report.candidates, failed: report.failed, skipped: report.skipped })[outcome].push(key);
  }
  return report;
}

/** Media URLs embedded anywhere in a JSON/text value → keys under assets/. */
function keysInText(text: string | null | undefined, into: Set<string>): void {
  if (!text) return;
  for (const key of mediaKeysInText(text)) if (key.startsWith(ASSETS_PREFIX)) into.add(key);
}

/**
 * Snapshot of every protected key (global, all organizations) for the bucket
 * sweep's pre-filter. Each candidate is still re-checked under its lock by
 * releaseObjectsIfUnreferenced before anything happens.
 */
export async function collectProtectedKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const resources = await db.selectFrom("asset_version_resource").select("storage_key").where("storage_key", "is not", null).execute();
  for (const row of resources) if (row.storage_key) keys.add(row.storage_key);
  const receipts = await db.selectFrom("upload_receipt").select("storage_key").where("expires_at", ">", sql<Date>`now()`).execute();
  for (const row of receipts) keys.add(row.storage_key);
  const anchors = await db.selectFrom("anchor_embedding").select("image_url").execute();
  for (const row of anchors) keysInText(row.image_url, keys);
  const payloads = await db.selectFrom("asset_version").select(sql<string>`payload::text`.as("payload_text")).execute();
  for (const row of payloads) keysInText(row.payload_text, keys);
  const legacy = await db
    .selectFrom("asset")
    .select(["file_url", sql<string | null>`metadata::text`.as("metadata_text"), sql<string | null>`config::text`.as("config_text"), "text_content"])
    .execute();
  for (const row of legacy) {
    const direct = row.file_url ? mediaKeyFromUrl(row.file_url) : null;
    if (direct) keys.add(direct);
    keysInText(row.file_url, keys);
    keysInText(row.metadata_text, keys);
    keysInText(row.config_text, keys);
    keysInText(row.text_content, keys);
  }
  for (const key of [...keys]) for (const related of relatedKeys(key)) keys.add(related);
  return keys;
}
