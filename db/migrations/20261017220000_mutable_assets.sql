-- Assets have one mutable content record. Stop old writers before upgrading.
lock table asset, asset_version, asset_version_resource, placement, scene, scene_revision,
  scene_asset_ref, scene_revision_asset_ref, anchor_embedding in access exclusive mode;
select set_config('content_model.writer','migration',true);

create table migration_archive.mutable_asset_source (
  source_table text not null, source_key text not null, row_data jsonb not null,
  captured_at timestamptz not null default now(), primary key(source_table,source_key)
);
insert into migration_archive.mutable_asset_source(source_table,source_key,row_data)
select 'asset', id::text,to_jsonb(t) from asset t union all
select 'asset_version',id::text,to_jsonb(t) from asset_version t union all
select 'asset_version_resource',asset_version_id::text||':'||role||':'||ordinal,to_jsonb(t) from asset_version_resource t union all
select 'scene',id::text,to_jsonb(t) from scene t union all
select 'scene_revision',id::text,to_jsonb(t) from scene_revision t union all
select 'placement',id::text,to_jsonb(t) from placement t union all
select 'anchor_embedding',asset_version_id::text,to_jsonb(t) from anchor_embedding t;

do $$ begin
  if exists(select 1 from asset a left join asset_version v on v.id=a.current_version_id and v.asset_id=a.id where v.id is null) then
    raise exception 'Asset without a valid current version; repair before migrating';
  end if;
end $$;
alter table asset add column payload jsonb;
update asset a set payload=v.payload from asset_version v where v.id=a.current_version_id;
alter table asset alter column payload set not null;
alter table asset add constraint asset_payload_check check(jsonb_typeof(payload)='object' and payload ? 'kind' and payload->>'kind'=file_type);
CREATE TABLE public.asset_resource (
    asset_id uuid NOT NULL,
    role text NOT NULL,
    ordinal integer DEFAULT 0 NOT NULL,
    storage_key text,
    external_url text,
    content_hash text,
    mime_type text,
    size_bytes integer,
    CONSTRAINT asset_resource_key_check CHECK (((storage_key IS NULL) OR (((length(storage_key) >= 1) AND (length(storage_key) <= 1024)) AND (storage_key !~ '^[A-Za-z][A-Za-z0-9+.-]*:'::text) AND (storage_key !~ '(^|/)\.\.(/|$)'::text) AND (storage_key !~ '^/'::text)))),
    CONSTRAINT asset_resource_ordinal_check CHECK ((ordinal >= 0)),
    CONSTRAINT asset_resource_role_check CHECK ((role = ANY (ARRAY['primary'::text, 'thumbnail'::text, 'checkin'::text, 'audio_compat'::text, 'reference'::text]))),
    CONSTRAINT asset_resource_size_check CHECK (((size_bytes IS NULL) OR (size_bytes >= 0))),
    CONSTRAINT asset_resource_target_check CHECK ((num_nonnulls(storage_key, external_url) = 1)),
    CONSTRAINT asset_resource_url_check CHECK (((external_url IS NULL) OR (external_url ~ '^https?://'::text)))
);
alter table asset_resource add primary key(asset_id,role,ordinal);
alter table asset_resource add constraint asset_resource_asset_fk foreign key(asset_id) references asset(id) on delete cascade;
create index asset_resource_storage_key_idx on asset_resource(storage_key) where storage_key is not null;
insert into asset_resource(asset_id,role,ordinal,storage_key,external_url,content_hash,mime_type,size_bytes)
select a.id,r.role,r.ordinal,r.storage_key,r.external_url,r.content_hash,r.mime_type,r.size_bytes
from asset a join asset_version_resource r on r.asset_version_id=a.current_version_id;

-- Historical files remain recoverable from the archive; no storage deletion here.
insert into storage_hold(storage_key,reason)
select distinct r.storage_key,'Archived asset version before mutable-asset migration'
from asset_version_resource r where r.storage_key is not null
and not exists(select 1 from asset_resource ar where ar.storage_key=r.storage_key)
on conflict(storage_key) do nothing;

-- Scene layouts/publications remain; every alias now reads its asset directly.
create function pg_temp.live_asset_document(doc jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(jsonb_set(doc,'{schemaVersion}','4'::jsonb),'{content,assets}',
    coalesce((select jsonb_object_agg(key,value-'assetVersionId') from jsonb_each(doc#>'{content,assets}')),'{}'::jsonb));
$$;
alter table scene_revision disable trigger scene_revision_immutable;
update scene set draft_document=pg_temp.live_asset_document(draft_document);
update scene_revision set document=pg_temp.live_asset_document(document);
alter table scene_revision enable trigger scene_revision_immutable;
alter table scene_asset_ref drop column asset_version_id;
alter table scene_revision_asset_ref drop column asset_version_id;
alter table placement drop column asset_version_id;
alter table placement add constraint placement_asset_org_fk foreign key(asset_id,organization_id) references asset(id,organization_id) on delete restrict;
alter table placement add constraint placement_target_xor check(num_nonnulls(asset_id,scene_revision_id)=1);

-- Keep only features of the selected content. Changed reference images invalidate
-- features through the application, with a generation guard for in-flight work.
delete from anchor_embedding e using asset a where e.anchor_id=a.id and e.asset_version_id<>a.current_version_id;
update anchor_embedding set status='failed' where status='pending';
alter table anchor_embedding drop column asset_version_id;
alter table anchor_embedding add primary key(anchor_id);

alter table asset drop column current_version_id;
drop table asset_version_resource,asset_version;
alter table upload_receipt drop constraint upload_receipt_purpose_check;
update upload_receipt set purpose='asset';
alter table upload_receipt add constraint upload_receipt_purpose_check check(purpose='asset');
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
  delete from public.scene_revision_asset_ref where organization_id = any(_org_ids);
  delete from public.scene_revision where organization_id = any(_org_ids);
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
