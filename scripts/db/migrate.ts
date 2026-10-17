import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { loadEnvFile, requireEnv } from "../lib/env";

/**
 * Apply the database schema.
 *
 *   npx tsx scripts/db/migrate.ts            # uses DATABASE_URL from .env.local
 *   DATABASE_URL=postgres://… npx tsx scripts/db/migrate.ts
 *
 * A fresh database gets db/schema.sql (the baseline). Then every file in
 * db/migrations/ is applied in name order unless schema_migrations already
 * lists it. Each file runs in its own transaction.
 */
async function main() {
  loadEnvFile();
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();

  try {
    // A single migration owner per database also protects the fresh-baseline
    // decision. App instances must not race while both see an empty ledger.
    await client.query("select pg_advisory_lock(hashtext('sanlin.schema-migrations'))");
    const { rows } = await client.query<{ exists: boolean }>(
      "select to_regclass('public.schema_migrations') is not null as exists",
    );
    if (!rows[0].exists) {
      const existing = await client.query<{ relation: string | null }>(
        "select to_regclass(name)::text as relation from unnest(array['public.organization','public.workspace','public.asset','auth.users']) as name",
      );
      if (existing.rows.some((row) => row.relation !== null)) {
        throw new Error("Existing application tables have no migration ledger; inspect and restore the ledger before applying a baseline");
      }
      console.log("fresh database: applying db/schema.sql");
      await client.query("begin");
      try {
        await client.query(readFileSync(resolve("db/schema.sql"), "utf8"));
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    const applied = new Set(
      (await client.query<{ name: string }>("select name from schema_migrations")).rows.map(
        (r) => r.name,
      ),
    );

    let files: string[] = [];
    try {
      files = readdirSync(resolve("db/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      // no migrations directory yet
    }

    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`applying ${file}`);
      await client.query("begin");
      try {
        await client.query(readFileSync(resolve("db/migrations", file), "utf8"));
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
    console.log("database is up to date");
  } finally {
    try { await client.query("select pg_advisory_unlock(hashtext('sanlin.schema-migrations'))"); }
    finally { await client.end(); }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
