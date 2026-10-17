import { db, sql, type DB } from "@/lib/db";
import type { Kysely, Transaction } from "kysely";
import { createHash } from "node:crypto";
import "server-only";
import { ContentError } from "./errors";

export type Executor = Kysely<DB>;
export type Trx = Transaction<DB>;

/** Immutable rows may only be removed by an explicit purge transaction. */
export type ContentWriter = "content" | "migration" | "purge";

export async function declareWriter(trx: Trx, writer: ContentWriter = "content"): Promise<void> {
  await sql`select set_config('content_model.writer', ${writer}, true)`.execute(trx);
}

/** One transaction of the content-model services. */
export function contentTransaction<T>(fn: (trx: Trx) => Promise<T>, writer: ContentWriter = "content"): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await declareWriter(trx, writer);
    return fn(trx);
  });
}

// ── advisory locks ──
// Transaction-scoped and always taken in sorted order to avoid deadlocks.
// Namespaces:
//   object-key:<storageKey>              object reuse/commit vs. garbage collection
//   idempotency:<actor>:<command>:<key>  concurrent retries of one command
// (New references and asset archiving serialize on the asset row itself:
// FOR SHARE in ensureAssetUse, FOR UPDATE when archiving.)

export async function lockKeys(trx: Trx, keys: Iterable<string>): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(trx);
  }
}

export const objectLockKey = (storageKey: string) => `object-key:${storageKey}`;

// ── idempotency ──

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function requestHash(body: unknown): string {
  return createHash("sha256").update(stableStringify(body)).digest("hex");
}

export interface IdempotencyScope {
  actorId: string;
  command: string;
  key: string;
  hash: string;
}

/**
 * Serialize retries of one command and return the earlier result id, if any.
 * A reused key with a different body is a client error, not a replay.
 */
export async function claimIdempotency(trx: Trx, scope: IdempotencyScope): Promise<string | null> {
  await lockKeys(trx, [`idempotency:${scope.actorId}:${scope.command}:${scope.key}`]);
  const row = await trx
    .selectFrom("content_command_idempotency")
    .select(["request_hash", "result_id"])
    .where("actor_id", "=", scope.actorId)
    .where("command", "=", scope.command)
    .where("idempotency_key", "=", scope.key)
    .executeTakeFirst();
  if (!row) return null;
  if (row.request_hash !== scope.hash)
    throw new ContentError("IDEMPOTENCY_CONFLICT", "该 idempotencyKey 已用于不同的请求内容");
  return row.result_id;
}

export async function recordIdempotency(
  trx: Trx,
  scope: IdempotencyScope,
  organizationId: string,
  resultType: string,
  resultId: string,
): Promise<void> {
  await trx
    .insertInto("content_command_idempotency")
    .values({
      actor_id: scope.actorId,
      command: scope.command,
      idempotency_key: scope.key,
      organization_id: organizationId,
      request_hash: scope.hash,
      result_type: resultType,
      result_id: resultId,
    })
    .execute();
}

// ── audit ──

export interface AuditEntry {
  organizationId: string | null;
  actorId: string | null;
  action: string;
  objectType: "asset" | "asset_version" | "scene" | "scene_revision" | "placement" | "workspace" | "organization";
  objectId: string | null;
  workspaceId?: string | null;
  details?: Record<string, unknown>;
}

export async function audit(trx: Executor, entry: AuditEntry): Promise<void> {
  await trx
    .insertInto("content_audit_log")
    .values({
      organization_id: entry.organizationId,
      actor_id: entry.actorId,
      action: entry.action,
      object_type: entry.objectType,
      object_id: entry.objectId,
      workspace_id: entry.workspaceId ?? null,
      details: JSON.stringify(entry.details ?? {}),
    })
    .execute();
}

export const toIso = (value: Date | string | null | undefined): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const toIsoRequired = (value: Date | string): string => (value instanceof Date ? value : new Date(value)).toISOString();
