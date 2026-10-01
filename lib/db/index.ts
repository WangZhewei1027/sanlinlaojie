import "server-only";
import { Kysely, PostgresDialect, sql } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import { Pool, types } from "pg";
import type { DB } from "./types";

// Query builder over the self-hosted PostgreSQL. One pool per process is the
// intended shape here (long-running Node server, not per-request lambdas).
//
// Conventions for callers:
//   - `db.selectFrom("asset")…` for tables; Postgres functions are called with
//     `sql` (e.g. sql`select * from get_user_organizations(${id})`).
//   - `jsonArrayFrom` / `jsonObjectFrom` replace PostgREST's nested selects.
//   - geometry columns come back as hex EWKB strings; read coordinates with
//     ST_X / ST_Y in the query instead of parsing on the client.

// Return bigint counts (count(*)) as numbers — the app never counts past 2^53.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

declare global {
  var __sanlinPgPool: Pool | undefined;
}

// The pool is created on first use, not at import time: `next build` loads
// every route module to collect metadata, and the build image has no
// DATABASE_URL. Survives Next.js dev hot-reloads without leaking pools.
function getPool(): Pool {
  if (globalThis.__sanlinPgPool) return globalThis.__sanlinPgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
  });
  globalThis.__sanlinPgPool = pool;
  return pool;
}

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: async () => getPool() }),
});

export { sql, jsonArrayFrom, jsonObjectFrom };
export type { DB } from "./types";
