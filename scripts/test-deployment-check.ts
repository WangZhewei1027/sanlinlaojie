/** Verify deployment gates on a NEW disposable DB, never on an application DB. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/postgres", "use the validation cluster's admin database");
  const name = `release_gate_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let created = false;
  let db: Client | undefined;
  const sql = execFileSync(process.execPath, ["scripts/db/deployment-check.mjs"], { encoding: "utf8" });
  try {
    await admin.query(`create database ${name}`); created = true;
    url.pathname = `/${name}`;
    db = new Client({ connectionString: url.toString() }); await db.connect();
    const reject = async (pattern: RegExp) => {
      await assert.rejects(db!.query(sql), pattern);
      await db!.query("rollback");
    };
    await reject(/no migration ledger/);
    for (let pass = 0; pass < 2; pass++) {
      const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/db/migrate.ts"], {
        env: { ...process.env, DATABASE_URL: url.toString(), NEXT_PUBLIC_MEDIA_BASE_URL: "https://release-check.invalid" }, encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    await db.query(sql);
    const ledger = (await db.query<{ name: string }>("select name from schema_migrations order by name")).rows;
    const latest = ledger.filter((entry) => entry.name !== "schema.sql").at(-1)!.name;
    await db.query("delete from schema_migrations where name=$1", [latest]);
    await reject(/pending database migrations/);
    await db.query("insert into schema_migrations(name) values($1)", [latest]);
    await db.query("alter table scene rename column document to draft_document");
    await reject(/ledger disagrees with schema/);
    await db.query("alter table scene rename column draft_document to document");
    await db.query("create table asset_version(id uuid)");
    await reject(/obsolete runtime content structures/);
    await db.query("drop table asset_version");
    await db.query(sql);
    assert.deepEqual((await db.query("select name from schema_migrations order by name")).rows, ledger);
    assert.ok(readFileSync("scripts/deploy.sh", "utf8").includes("deployment-check.mjs"));
    assert.ok(readFileSync(".github/workflows/deploy.yml", "utf8").includes("needs: quality"));
    console.log("PASS fresh migration + replay; release gate rejects absent/pending ledger, schema drift and obsolete tables without changing the ledger");
  } finally {
    await db?.end();
    if (created) await admin.query(`drop database ${name}`);
    await admin.end();
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Deployment check failed"); process.exitCode = 1; });
