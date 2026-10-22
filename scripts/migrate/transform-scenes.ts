import type { Client } from "pg";
import { TRANSFORM_CHANNELS, type CompositionInstance } from "../../lib/scene/protocol";
import { parseSceneDocument } from "../../lib/scene/validate";
import { legacyValues, type LegacyContent } from "./legacy-theatre-state";
import { validateTheatreState } from "./validate-theatre";
import { IssueList } from "../../lib/scene/validate-utils";

type OldTrack = { keyframes: { position: number; value: number; handles: [number, number, number, number]; connectedRight: boolean; type?: string }[] };
type OldSheet = { staticOverrides: { byObject: Record<string, Partial<Record<'position' | 'rotation' | 'scale', Partial<Record<'x' | 'y' | 'z', number>>>>> }; sequence: { length: number; tracksByObject: Record<string, { trackIdByPropPath: Record<string, string>; trackData: Record<string, OldTrack> }> } };
/** One-time, dependency-free conversion. The live API accepts schema 6 only. */
export function upgradeTransformDocument(value: unknown) {
  const old = value as { schemaVersion: number; content: LegacyContent & { theatre?: { sheetsById: { Scene: OldSheet } } } };
  if (old.schemaVersion === 6) return parseSceneDocument(value);
  if (old.schemaVersion !== 4 && old.schemaVersion !== 5) throw new Error("Expected scene schema 4 or 5");
  const { theatre, ...content } = old.content;
  if (old.schemaVersion === 5) {
    const issues = new IssueList();
    validateTheatreState(issues, theatre, new Set(content.instances.map(i => i.id)), content.durationSeconds);
    if (issues.hasErrors) throw new Error(JSON.stringify(issues.issues));
  }
  const sheet = theatre?.sheetsById.Scene;
  const instances: CompositionInstance[] = content.instances.map(oldInstance => {
    const { quaternion: _quaternion, tracks: oldTracks, ...rest } = oldInstance;
    const values = legacyValues(oldInstance);
    const overrides = sheet?.staticOverrides.byObject[oldInstance.id];
    for (const group of ['position', 'rotation', 'scale'] as const) Object.assign(values[group], overrides?.[group]);
    const tuple = (v: { x: number; y: number; z: number }): [number, number, number] => [v.x, v.y, v.z];
    const instance: CompositionInstance = { ...rest, position: tuple(values.position), rotation: tuple(values.rotation), scale: tuple(values.scale) };
    const tracks: NonNullable<CompositionInstance['tracks']> = structuredClone(oldTracks ?? {});
    const object = sheet?.sequence.tracksByObject[instance.id];
    if (object) for (const channel of TRANSFORM_CHANNELS) {
      const track = object.trackData[object.trackIdByPropPath[JSON.stringify(channel.split('.'))]];
      if (track?.keyframes.length) tracks[channel] = track.keyframes.map(frame => ({ time: frame.position, value: frame.value, handles: [...frame.handles], connectedRight: frame.connectedRight && frame.type !== 'hold' }));
    }
    if (Object.keys(tracks).length) instance.tracks = tracks;
    return instance;
  });
  return parseSceneDocument({ schemaVersion: 6, content: { ...content, instances } });
}
export async function migrateTransformScenes(db: Client) {
  // The caller holds the migration transaction and advisory lock.
  await db.query(`alter table public.scene drop constraint if exists scene_native_theatre_version_check;
    create schema if not exists migration_archive;
    create table if not exists migration_archive.transform_scene_source (
      scene_id uuid primary key, document jsonb not null, lock_version bigint not null, archived_at timestamptz not null default now()
    )`);
  const { rows } = await db.query("select id, document, lock_version from scene order by id for update");
  for (const row of rows) {
    const next = upgradeTransformDocument(row.document);
    if (row.document.schemaVersion === 6) continue;
    await db.query("insert into migration_archive.transform_scene_source(scene_id,document,lock_version) values($1,$2,$3) on conflict do nothing", [row.id, row.document, row.lock_version]);
    await db.query("update scene set document=$2, lock_version=lock_version+1, updated_at=now() where id=$1", [row.id, next]);
  }
}
