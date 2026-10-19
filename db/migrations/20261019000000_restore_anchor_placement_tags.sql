-- The hard cutover created anchor placements without copying their map tags.
-- Recover only original, unedited migration placements. Never replace later edits
-- or resurrect deleted tags; fresh databases have no migration archive to read.
do $$ begin
  if to_regclass('migration_archive.content_model_source') is not null then
    lock table placement, placement_tag in share row exclusive mode;
    insert into placement_tag(placement_id,tag_id,workspace_id)
    select p.id,t.id,p.workspace_id
    from migration_archive.content_model_source s
    join asset a on a.id::text=s.source_key and a.file_type='anchor'
    join placement p on p.asset_id=a.id and p.lock_version=1
      and p.id=md5('anchor-placement:'||p.workspace_id::text||':'||a.id::text)::uuid
    join tag t on t.workspace_id=p.workspace_id and s.row_data->'tag_ids' ? t.id::text
    where s.source_table='asset'
    on conflict do nothing;
  end if;
end $$;
