import { readFileSync } from "node:fs";
import type { Client } from "pg";

export const ACTIVITY_LOCATION_MIGRATION = "20261028010000_activity_owned_locations.sql";

export interface ActivityLocationConflict {
  kind: "point_location" | "point_enabled" | "effective_config" | "activity_center" | "participation_area" | "duplicate_association" | "incomplete_area";
  organization_id: string;
  activity_id: string;
  point_id: string | null;
  sources: unknown;
}

/** The audit and the SQL upgrade use exactly the same conflict query. */
export async function activityLocationMigrationReport(client: Client) {
  const source = readFileSync(new URL(`../../db/migrations/${ACTIVITY_LOCATION_MIGRATION}`, import.meta.url), "utf8");
  const query = source.split("-- BEGIN ACTIVITY LOCATION CONFLICT QUERY\n")[1]?.split("-- END ACTIVITY LOCATION CONFLICT QUERY")[0];
  if (!query) throw new Error("Activity location migration conflict query is missing");
  const conflicts = (await client.query<ActivityLocationConflict>(query)).rows;
  const counts = (await client.query<{ activities: number; points: number; placements: number; point_placements: number; records: number }>(`
    select (select count(*)::int from activity) activities,
      (select count(*)::int from activity_point) points,
      (select count(*)::int from activity_placement) placements,
      (select count(*)::int from activity_point_placement) point_placements,
      (select count(*)::int from activity_record) records
  `)).rows[0];
  return { format: "activity-owned-locations-audit-v1", counts, conflicts };
}

/** Called in the migrator's transaction; the SQL also validates direct execution. */
export async function prepareActivityOwnedLocationsMigration(client: Client): Promise<void> {
  await client.query("lock table activity, activity_point, activity_placement, activity_point_placement, activity_record in access exclusive mode");
  const report = await activityLocationMigrationReport(client);
  if (report.conflicts.length) {
    const examples = report.conflicts.slice(0, 10).map((row) => `${row.kind}: activity=${row.activity_id}${row.point_id ? ` point=${row.point_id}` : ""}`);
    throw new Error(`Activity-owned locations migration blocked: ${report.conflicts.length} conflicting groups (${examples.join("; ")}). Run scripts/db/activity-location-preflight.ts --output /private/path/activity-locations.json`);
  }
}
