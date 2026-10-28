import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { activityMigrationReport } from "./activity-migration";

/** Read-only source inventory. An explicit connection and output path prevent
 * accidental use of development credentials or dumping user messages to logs. */
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output" || !process.env.DATABASE_URL) {
    throw new Error("Usage: DATABASE_URL=... npx tsx scripts/db/activity-preflight.ts --output /private/path/activity-audit.json");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const report = await activityMigrationReport(client);
    await client.query("commit");
    writeFileSync(args[1], JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    const ambiguous = report.texts.filter((row) => row.classification === "review_required").length;
    console.log(`Saved read-only activity inventory. ${report.texts.length} text assets; ${ambiguous} require explicit classification; ${report.shopGroups.length} historical shop groups.`);
  } finally { await client.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Activity preflight failed"); process.exitCode = 1; });
