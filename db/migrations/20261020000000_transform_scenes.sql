-- Data conversion and source archive run transactionally in migrateTransformScenes.
ALTER TABLE public.scene ADD CONSTRAINT scene_transform_version_check
  CHECK ((document @> '{"schemaVersion":6}'::jsonb AND NOT (document->'content' ? 'theatre')) IS TRUE);
