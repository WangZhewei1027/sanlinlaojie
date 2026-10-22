import type { Client } from "pg";
import { stateFromDefinition } from "./legacy-theatre-state";
import type { LegacyContent, NativeState } from "./legacy-theatre-state";
import { validateTheatreState } from "./validate-theatre";
import { IssueList } from "../../lib/scene/validate-utils";
function parseSceneDocument(value: unknown) {
  const doc = value as { schemaVersion: 5; content: LegacyContent & { theatre: NativeState } };
  if (doc.schemaVersion !== 5 || !doc.content) throw new Error("Expected historical schema 5");
  const issues = new IssueList();
  validateTheatreState(issues, doc.content.theatre, new Set(doc.content.instances.map(i => i.id)), doc.content.durationSeconds);
  if (issues.hasErrors) throw new Error(JSON.stringify(issues.issues));
  return doc;
}

export function upgradeTheatreDocument(value: unknown) {
  const old = value as { schemaVersion?: number; content?: LegacyContent };
  if (old.schemaVersion === 5) return parseSceneDocument(value);
  if (old.schemaVersion !== 4 || !old.content) throw new Error("Only schema 4 scenes can be upgraded to native Theatre");
  const content = old.content;
  const theatre = stateFromDefinition({ content });
  return parseSceneDocument({ schemaVersion: 5, content: { ...content, durationSeconds: theatre.sheetsById.Scene.sequence.length, theatre,
    instances: content.instances.map(({ tracks: _legacyTracks, ...instance }) => instance) } });
}

/** Called inside the standard migration transaction, including on fresh deployments. */
export async function migrateTheatreScenes(db: Client) {
  await db.query(`create schema if not exists migration_archive;
    create table if not exists migration_archive.theatre_scene_source (
      scene_id uuid primary key, document jsonb not null, lock_version bigint not null, archived_at timestamptz not null default now()
    )`);
  const result = await db.query("select id, document, lock_version from scene order by id for update");
  for (const row of result.rows) {
    if (row.document.schemaVersion === 5) { parseSceneDocument(row.document); continue; }
    const next = upgradeTheatreDocument(row.document);
    await db.query("insert into migration_archive.theatre_scene_source(scene_id,document,lock_version) values($1,$2,$3) on conflict do nothing", [row.id, row.document, row.lock_version]);
    await db.query("update scene set document=$2, lock_version=lock_version+1, updated_at=now() where id=$1", [row.id, next]);
  }
}
