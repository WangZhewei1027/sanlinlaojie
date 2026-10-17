-- One content model. Stop application writers while upgrading. The migrator
-- converts unversioned sources before executing this file in the SAME transaction.
-- Keep a forensic snapshot outside the runtime schema; no application reads it.
lock table organization, workspace, asset, placement, scene in access exclusive mode;
select set_config('content_model.writer','migration',true);
create schema if not exists migration_archive;
create table migration_archive.content_model_source (
  source_table text not null, source_key text not null, row_data jsonb not null,
  captured_at timestamptz not null default now(), primary key(source_table,source_key)
);
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'asset',id::text,to_jsonb(a) from asset a;
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'legacy_runtime_binding',id::text,to_jsonb(b) from legacy_runtime_binding b;
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'legacy_content_map',binding_id::text||':'||workspace_id::text,to_jsonb(m) from legacy_content_map m;
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'workspace_assignment',id::text,to_jsonb(a) from workspace_assignment a;
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'asset_workspace_grant',asset_id::text||':'||workspace_id::text,to_jsonb(g) from asset_workspace_grant g;
insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'content_migration_map',id::text,to_jsonb(m) from content_migration_map m;

insert into migration_archive.content_model_source(source_table,source_key,row_data)
select 'asset_version',id::text,to_jsonb(v) from asset_version v;

-- A source shared by several maps becomes an independently editable placement
-- in each collection, pinned to the same version. No runtime sharing adapter.
create temporary table collection_placement_copy on commit drop as
select md5('collection-placement:'||m.workspace_id::text||':'||p.id::text)::uuid id,
       p.id source_id,m.workspace_id,m.tag_ids
from legacy_content_map m join legacy_runtime_binding b on b.id=m.binding_id
join placement p on p.id=b.placement_id
where m.active and m.workspace_id<>p.workspace_id;
insert into placement(id,organization_id,workspace_id,name,asset_id,asset_version_id,scene_revision_id,
  location,altitude,anchor_id,render_config,status,created_by,updated_by,created_at,updated_at)
select c.id,p.organization_id,c.workspace_id,p.name,p.asset_id,p.asset_version_id,p.scene_revision_id,
  p.location,p.altitude,p.anchor_id,p.render_config,p.status,p.created_by,p.updated_by,p.created_at,p.updated_at
from collection_placement_copy c join placement p on p.id=c.source_id;
insert into placement_tag(placement_id,tag_id,workspace_id)
select c.id,t.id,c.workspace_id from collection_placement_copy c join tag t on t.workspace_id=c.workspace_id and t.id=any(c.tag_ids);

-- Anchors use the same asset/version/placement model as all other content.
insert into placement(id,organization_id,workspace_id,name,asset_id,asset_version_id,location,altitude,render_config,status,created_by)
select md5('anchor-placement:'||w.id::text||':'||a.id::text)::uuid,a.organization_id,w.id,a.name,a.id,a.current_version_id,
  case when a.location is not null then ST_SetSRID(a.location,4326) end,
  case when jsonb_typeof(a.metadata->'height')='number' then (a.metadata->>'height')::double precision end,
  jsonb_build_object('config',coalesce(a.config,'{}'::jsonb)),
  case when a.location is null then 'draft' else 'active' end,a.created_by
from asset a join workspace w on w.id=any(a.workspace_id) and w.organization_id=a.organization_id
where a.file_type='anchor' and a.current_version_id is not null
and not exists(select 1 from placement p where p.asset_id=a.id and p.workspace_id=w.id);

-- Preserve any migrated display metadata in the placement before dropping the
-- migration envelope; immutable payloads then have the same shape as new ones.
update placement p set render_config = jsonb_set(p.render_config,'{display}',
  coalesce(v.payload->'migration_legacy'->'metadata','{}'::jsonb) || coalesce(p.render_config->'display','{}'::jsonb))
from asset_version v where p.asset_version_id=v.id and v.payload ? 'migration_legacy';
update placement p set render_config = jsonb_set(p.render_config,'{display}',
  coalesce(a.metadata,'{}'::jsonb) || coalesce(p.render_config->'display','{}'::jsonb))
from scene_revision r join scene s on s.id=r.scene_id join asset a on a.id=s.legacy_asset_id
where p.scene_revision_id=r.id;
alter table asset_version disable trigger asset_version_immutable;
update asset_version set payload=payload-'migration_legacy' where payload ? 'migration_legacy';
alter table asset_version enable trigger asset_version_immutable;

-- Quarantined sources have no defensible team owner. Keep their complete rows
-- in migration_archive and their files in an explicit retention hold.
create table public.storage_hold (
  storage_key text primary key, reason text not null, created_at timestamptz not null default now()
);
insert into storage_hold(storage_key,reason)
select distinct match[1], 'Archived source reference '||a.id::text
from asset a cross join lateral regexp_matches(to_jsonb(a)::text, '(assets/[^"[:space:]?#]+)', 'g') match
where not exists(select 1 from asset_version_resource r where r.storage_key=match[1])
on conflict(storage_key) do nothing;
do $$ begin
  if exists(select 1 from asset a where a.current_version_id is null and not exists(select 1 from scene s where s.legacy_asset_id=a.id)
    and not exists(select 1 from content_migration_map m where m.source_id=a.id and m.status='quarantined' and m.reason is not null)) then
    raise exception 'Unconverted asset rows remain; refusing to discard content';
  end if;
end $$;

-- Retire old writers, lookup tables, model selection and raw content fields.
drop trigger guard_legacy_asset_write on asset;
drop trigger validate_asset_workspace_ids on asset;
drop trigger validate_asset_anchor on asset;
drop trigger invalidate_anchor_embedding on asset;
drop function guard_legacy_asset_write();
drop function get_user_workspaces(uuid);
drop function validate_workspace_ids();
drop function validate_asset_anchor();
drop function invalidate_anchor_embedding();
drop function move_assets(jsonb);
drop function get_nearby_assets(double precision,double precision,double precision,uuid,uuid);
drop function get_huge_assets(uuid,uuid);
drop function get_shop_assets(uuid,uuid);
drop function upload_text_asset(text,uuid,uuid,double precision,double precision,jsonb);
drop function finalize_anchor_match(uuid,double precision,double precision,double precision,uuid,jsonb);
drop function prepare_anchor_match_context(uuid,double precision,double precision,double precision);
drop function read_anchor_match_context(uuid,double precision,double precision,double precision);
drop function find_nearby_matching_anchors(uuid,double precision,double precision,double precision);
drop function begin_anchor_embedding(uuid,text,uuid);
drop table legacy_content_map,legacy_runtime_binding,asset_workspace_grant,workspace_assignment;
delete from asset where current_version_id is null;
alter table asset alter column organization_id set not null;
alter table asset add constraint asset_organization_fk foreign key(organization_id) references organization(id);
alter table asset drop column workspace_id,drop column file_url,drop column text_content,drop column location,
  drop column metadata,drop column config,drop column anchor_id,drop column tag_ids,drop column is_huge,drop column content_hash;
alter table organization drop column content_model_state,drop column content_model_changed_at;
alter table scene drop column legacy_asset_id;
update upload_receipt set purpose='asset_version' where purpose in ('legacy_asset','anchor_reference');
alter table upload_receipt drop constraint upload_receipt_purpose_check;
alter table upload_receipt add constraint upload_receipt_purpose_check check(purpose = 'asset_version');

-- Feature vectors belong to the immutable reference image version.
alter table anchor_embedding add column asset_version_id uuid;
update anchor_embedding e set asset_version_id=a.current_version_id from asset a where a.id=e.anchor_id;
delete from anchor_embedding where asset_version_id is null;
alter table anchor_embedding drop constraint anchor_embedding_pkey;
alter table anchor_embedding alter column asset_version_id set not null;
alter table anchor_embedding add primary key(asset_version_id);
alter table anchor_embedding add constraint anchor_embedding_version_asset_fk
  foreign key(asset_version_id,anchor_id) references asset_version(id,asset_id) on delete cascade;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  user_name text;
  new_org_id uuid;
  default_types text[];
begin
  user_name := nullif(new.name, '');

  -- 新组织的默认文件类型（super-admin 系统设置可改）；配置行缺失时兜底
  select array(select jsonb_array_elements_text(value))
  into default_types
  from public.app_config
  where key = 'default_allowed_file_types';

  if default_types is null then
    default_types := array['image','video','audio','link','text','anchor','shop'];
  end if;

  insert into public.users (user_id, name, role, email)
  values (new.id, user_name, 'user', new.email);

  -- Team workbench: a new personal team starts with
  -- zero map collections (content needs none; collections are created on demand).
  insert into public.organization (name, created_by, allowed_file_types)
  values (
    coalesce(user_name, split_part(new.email, '@', 1)) || '''s Organization',
    new.id,
    default_types
  )
  returning id into new_org_id;

  insert into public.organization_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- Keep public.users.email in sync when the login email changes.

create or replace function public.purge_organizations(_org_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public set content_model.writer = 'purge' as $$
declare
  _ws_ids uuid[];
  _deleted_assets integer := 0;
  _deleted_workspaces integer := 0;
  _deleted_orgs integer := 0;
  _deleted_versions integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into _ws_ids
  from public.workspace
  where organization_id = any(_org_ids);

  -- content model rows (dependency order; everything is organization-scoped)
  delete from public.placement where organization_id = any(_org_ids);
  delete from public.scene_revision_asset_ref where organization_id = any(_org_ids);
  delete from public.scene_revision where organization_id = any(_org_ids);
  delete from public.scene where organization_id = any(_org_ids);
  delete from public.upload_receipt where organization_id = any(_org_ids);
  delete from public.content_command_idempotency where organization_id = any(_org_ids);
  update public.asset set current_version_id = null
  where organization_id = any(_org_ids) and current_version_id is not null;
  delete from public.asset_version_resource r
  using public.asset_version v
  where v.id = r.asset_version_id and v.organization_id = any(_org_ids);
  delete from public.asset_version where organization_id = any(_org_ids);
  get diagnostics _deleted_versions = row_count;
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
    'deleted_orgs', _deleted_orgs,
    'deleted_versions', _deleted_versions
  );
end;
$$;


-- Migration evidence is outside the application schema.
alter table content_migration_map set schema migration_archive;
alter table content_migration_run set schema migration_archive;
