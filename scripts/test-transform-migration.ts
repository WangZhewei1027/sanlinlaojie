/** Local-only transaction test; all changes are rolled back, including DDL. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { loadEnvFile, requireEnv } from './lib/env';
import { migrateTransformScenes, upgradeTransformDocument } from './migrate/transform-scenes';
async function main() {
 loadEnvFile(); const url=new URL(requireEnv('DATABASE_URL'));
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)); assert.equal(url.port,'55432'); assert.equal(url.pathname,'/sanlin');
 const db=new Client({connectionString:url.toString()}); await db.connect();
 try {
  const before=(await db.query('select id, document, lock_version from scene order by id')).rows;
  const archived=(await db.query('select scene_id, document, lock_version from migration_archive.transform_scene_source order by scene_id limit 1')).rows[0];
  assert.ok(archived,'Run the standard migration first to establish a recoverable source archive');
  await db.query('begin');
  await db.query('alter table scene drop constraint scene_transform_version_check');
  await db.query('update scene set document=$2,lock_version=$3 where id=$1',[archived.scene_id,archived.document,archived.lock_version]);
  await db.query('delete from migration_archive.transform_scene_source where scene_id=$1',[archived.scene_id]);
  await migrateTransformScenes(db);
  await db.query(readFileSync('db/migrations/20261020000000_transform_scenes.sql','utf8'));
  const row=(await db.query('select document,lock_version from scene where id=$1',[archived.scene_id])).rows[0];
  assert.deepEqual(row.document,upgradeTransformDocument(archived.document));
  assert.equal(Number(row.lock_version),Number(archived.lock_version)+1);
  assert.deepEqual((await db.query('select document from migration_archive.transform_scene_source where scene_id=$1',[archived.scene_id])).rows[0].document,archived.document);
  await migrateTransformScenes(db);
  assert.equal((await db.query('select lock_version from scene where id=$1',[archived.scene_id])).rows[0].lock_version,row.lock_version);
  await db.query('savepoint invalid');
  await assert.rejects(db.query('update scene set document=$2 where id=$1',[archived.scene_id,archived.document]),{code:'23514'});
  await db.query('rollback to savepoint invalid');
  await db.query('rollback');
  assert.deepEqual((await db.query('select id,document,lock_version from scene order by id')).rows,before);
  console.log('PASS PostgreSQL transform migration: archive fidelity, lock increment, idempotence, constraint and full rollback');
 } finally { await db.query('rollback').catch(()=>{});await db.end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
