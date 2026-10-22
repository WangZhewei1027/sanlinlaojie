-- scripts/db/migrate.ts first archives and converts every schema 4 scene in this transaction.
-- No dual reader remains in the application. An open old editor loses its optimistic lock.
ALTER TABLE public.scene ADD CONSTRAINT scene_native_theatre_version_check
  CHECK ((document @> '{"schemaVersion":5}'::jsonb AND document#>>'{content,theatre,definitionVersion}' = '0.4.0') IS TRUE);
