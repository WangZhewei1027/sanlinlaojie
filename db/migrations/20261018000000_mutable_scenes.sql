-- Scene saves are live. Stop application writers before this migration.
lock table scene, scene_asset_ref, scene_revision, scene_revision_asset_ref, placement in access exclusive mode;
create schema if not exists migration_archive;
create table migration_archive.mutable_scene_source (
  source_table text not null, source_key text not null, row_data jsonb not null,
  captured_at timestamptz not null default now(), primary key(source_table,source_key)
);
insert into migration_archive.mutable_scene_source(source_table,source_key,row_data)
select 'scene',id::text,to_jsonb(t) from scene t union all
select 'scene_revision',id::text,to_jsonb(t) from scene_revision t union all
select 'scene_revision_asset_ref',scene_revision_id::text||':'||resource_alias,to_jsonb(t) from scene_revision_asset_ref t union all
select 'placement',id::text,to_jsonb(t) from placement t where scene_revision_id is not null;

alter table placement add column scene_id uuid;
update placement p set scene_id=r.scene_id from scene_revision r where p.scene_revision_id=r.id;
do $$ begin
  if exists(select 1 from placement where scene_revision_id is not null and scene_id is null) then
    raise exception 'Unresolved scene placement; migration cancelled';
  end if;
end $$;
alter table placement drop column scene_revision_id;
alter table placement add constraint placement_target_xor check(num_nonnulls(asset_id,scene_id)=1);
alter table placement add constraint placement_scene_fk foreign key(scene_id,organization_id) references scene(id,organization_id) on delete restrict;
create index placement_scene_idx on placement(scene_id) where scene_id is not null;
alter table scene rename column draft_document to document;
alter table scene rename constraint scene_draft_document_check to scene_document_check;
drop table scene_revision_asset_ref, scene_revision;
drop function public.reject_immutable_content_change();
CREATE OR REPLACE FUNCTION public.purge_organizations(_org_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET "content_model.writer" TO 'purge'
    AS $$
declare
  _ws_ids uuid[];
  _deleted_assets integer := 0;
  _deleted_workspaces integer := 0;
  _deleted_orgs integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into _ws_ids
  from public.workspace
  where organization_id = any(_org_ids);

  -- content model rows (dependency order; everything is organization-scoped)
  delete from public.placement where organization_id = any(_org_ids);
  delete from public.scene where organization_id = any(_org_ids);
  delete from public.upload_receipt where organization_id = any(_org_ids);
  delete from public.content_command_idempotency where organization_id = any(_org_ids);
  -- placements of other organizations never reference these anchors (same-org rule)
  delete from public.asset where organization_id = any(_org_ids);
  get diagnostics _deleted_assets = row_count;

  if array_length(_ws_ids, 1) is not null then
    delete from public.workspace where id = any(_ws_ids);
    get diagnostics _deleted_workspaces = row_count;
  end if;

  -- 级联 organization_member / organization_invitation(organization_id)
  delete from public.organization where id = any(_org_ids);
  get diagnostics _deleted_orgs = row_count;

  return jsonb_build_object(
    'deleted_assets', _deleted_assets,
    'deleted_workspaces', _deleted_workspaces,
    'deleted_orgs', _deleted_orgs
  );
end;
$$;
