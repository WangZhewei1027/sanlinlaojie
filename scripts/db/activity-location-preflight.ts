import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { activityLocationMigrationReport } from "./activity-owned-locations";

/** No environment-file loading or mutation. Reports contain private placement metadata. */
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output" || !process.env.DATABASE_URL) {
    throw new Error("Usage: DATABASE_URL=... npx tsx scripts/db/activity-location-preflight.ts --output /private/path/activity-locations.json");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const report = await activityLocationMigrationReport(client);
    await client.query("commit");
    writeFileSync(args[1], JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`Saved read-only activity location inventory: ${report.counts.activities} activities, ${report.counts.points} points, ${report.counts.placements} placements, ${report.conflicts.length} conflicting groups.`);
  } finally { await client.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Activity location preflight failed"); process.exitCode = 1; });
