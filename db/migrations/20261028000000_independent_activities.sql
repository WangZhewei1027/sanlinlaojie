-- Stop old application writers before running this atomic migration.
-- scripts/db/activity-migration.ts locks and fingerprints all source rows first.
select set_config('content_model.writer', 'migration', true);

-- BEGIN ACTIVITY SCHEMA (also included in the fresh database baseline)
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete restrict,
  type text not null check (type in ('shop_checkin','danmaku')),
  name text not null check (length(btrim(name)) > 0),
  description text,
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  state text not null default 'active' check (state in ('active','archived')),
  lock_version integer not null default 1 check (lock_version > 0),
  created_by uuid references users(user_id) on delete set null,
  updated_by uuid references users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,organization_id)
);
create index activity_org_idx on activity(organization_id,state,created_at);

create table public.activity_point (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  organization_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  description text,
  ordinal integer not null default 0 check (ordinal >= 0),
  image_asset_id uuid,
  reward_asset_id uuid,
  state text not null default 'active' check (state in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,activity_id,organization_id),
  foreign key (activity_id,organization_id) references activity(id,organization_id) on delete restrict,
  foreign key (image_asset_id,organization_id) references asset(id,organization_id) on delete restrict,
  foreign key (reward_asset_id,organization_id) references asset(id,organization_id) on delete restrict
);
create index activity_point_activity_idx on activity_point(activity_id,ordinal,id);
create index activity_point_image_idx on activity_point(image_asset_id) where image_asset_id is not null;
create index activity_point_reward_idx on activity_point(reward_asset_id) where reward_asset_id is not null;

create table public.activity_placement (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  organization_id uuid not null,
  workspace_id uuid not null,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  location geometry(Point,4326),
  radius_meters double precision check (radius_meters > 0 and radius_meters < 'Infinity'::float8),
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  lock_version integer not null default 1 check (lock_version > 0),
  created_by uuid references users(user_id) on delete set null,
  updated_by uuid references users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,activity_id,organization_id),
  foreign key (activity_id,organization_id) references activity(id,organization_id) on delete restrict,
  foreign key (workspace_id,organization_id) references workspace(id,organization_id) on delete restrict,
  check (radius_meters is null or location is not null),
  check (location is null or (st_x(location) between -180 and 180 and st_y(location) between -90 and 90))
);
create index activity_placement_workspace_idx on activity_placement(workspace_id,status);
create index activity_placement_activity_idx on activity_placement(activity_id,status);
create index activity_placement_location_idx on activity_placement using gist(location);

create table public.activity_point_placement (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null,
  activity_id uuid not null,
  organization_id uuid not null,
  point_id uuid not null,
  location geometry(Point,4326),
  enabled boolean not null default true,
  config jsonb not null default '{}' check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id,point_id),
  foreign key (placement_id,activity_id,organization_id) references activity_placement(id,activity_id,organization_id) on delete restrict,
  foreign key (point_id,activity_id,organization_id) references activity_point(id,activity_id,organization_id) on delete restrict,
  check (location is null or (st_x(location) between -180 and 180 and st_y(location) between -90 and 90))
);
create index activity_point_placement_location_idx on activity_point_placement using gist(location);

create table public.activity_record (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  activity_id uuid not null,
  placement_id uuid not null,
  point_id uuid,
  participant_id text check (length(participant_id) between 1 and 128),
  kind text not null check (kind in ('danmaku','checkin')),
  content text,
  location geometry(Point,4326),
  status text not null default 'visible' check (status in ('visible','hidden')),
  idempotency_key text check (length(idempotency_key) between 8 and 128),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  render_config jsonb not null default '{}' check (jsonb_typeof(render_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lock_version integer not null default 1 check (lock_version > 0),
  foreign key (placement_id,activity_id,organization_id) references activity_placement(id,activity_id,organization_id) on delete restrict,
  foreign key (point_id,activity_id,organization_id) references activity_point(id,activity_id,organization_id) on delete restrict,
  check ((kind='danmaku' and point_id is null and content is not null) or
    (kind='checkin' and point_id is not null and participant_id is not null and content is null)),
  check (location is null or (st_x(location) between -180 and 180 and st_y(location) between -90 and 90))
);
create index activity_record_activity_idx on activity_record(activity_id,created_at desc,id);
create index activity_record_placement_idx on activity_record(placement_id,status,created_at desc,id);
create index activity_record_location_idx on activity_record using gist(location);
create unique index activity_record_retry_unique on activity_record(placement_id,participant_id,idempotency_key)
  where participant_id is not null and idempotency_key is not null;
create unique index activity_record_checkin_unique on activity_record(placement_id,participant_id,point_id) where kind='checkin';
alter table activity_record add constraint activity_record_deployed_point_fk
  foreign key (placement_id,point_id) references activity_point_placement(placement_id,point_id) on delete restrict;
-- END ACTIVITY SCHEMA

create table migration_archive.activity_source (
  source_table text not null,
  source_key text not null,
  row_data jsonb not null,
  captured_at timestamptz not null default now(),
  primary key(source_table,source_key)
);
create table migration_archive.activity_text_review (
  asset_id uuid primary key,
  source_hash text not null,
  decision text not null check (decision in ('migrate','keep')),
  reason text not null,
  reviewed_at timestamptz not null default now()
);
insert into migration_archive.activity_text_review(asset_id,source_hash,decision,reason)
select asset_id,source_hash,decision,reason from pg_temp.activity_text_classification;

-- Review refuses to guess a destination, discard references or collapse unrelated content.
do $$ begin
  if exists(select 1 from activity_text_classification c join asset a on a.id=c.asset_id
    where c.decision='migrate' and not exists(select 1 from placement p where p.asset_id=a.id)
    and not exists(select 1 from workspace w where w.id=a.origin_workspace_id and w.organization_id=a.organization_id)) then
    raise exception 'Activity migration: submitted text without a valid placement or origin workspace; repair before migrating';
  end if;
  if exists(select 1 from activity_text_classification c join asset_resource r on r.asset_id=c.asset_id where c.decision='migrate')
    or exists(select 1 from activity_text_classification c join scene_asset_ref r on r.asset_id=c.asset_id where c.decision='migrate')
    or exists(select 1 from activity_text_classification c join placement p on p.anchor_id=c.asset_id where c.decision='migrate') then
    raise exception 'Activity migration: submitted text has media, scene or anchor references; review and repair before migrating';
  end if;
  if exists(select 1 from asset_resource r join asset a on a.id=r.asset_id where a.file_type='shop'
    and (r.role not in ('primary','thumbnail','checkin') or (r.role='checkin' and r.ordinal<>0))) then
    raise exception 'Activity migration: shop has unsupported resource roles or multiple reward images; repair before migrating';
  end if;
end $$;

create temporary table activity_migrating_assets on commit drop as
select a.id from asset a where a.file_type='shop' or exists
  (select 1 from activity_text_classification c where c.asset_id=a.id and c.decision='migrate');
insert into migration_archive.activity_source(source_table,source_key,row_data)
select 'asset',a.id::text,to_jsonb(a) from asset a join activity_migrating_assets m on m.id=a.id union all
select 'asset_resource',r.asset_id::text||':'||r.role||':'||r.ordinal,to_jsonb(r)
  from asset_resource r join activity_migrating_assets m on m.id=r.asset_id union all
select 'placement',p.id::text,to_jsonb(p) from placement p join activity_migrating_assets m on m.id=p.asset_id union all
select 'placement_tag',t.placement_id::text||':'||t.tag_id,to_jsonb(t) from placement_tag t
  join placement p on p.id=t.placement_id join activity_migrating_assets m on m.id=p.asset_id union all
select 'organization',o.id::text,to_jsonb(o) from organization o union all
select 'workspace',w.id::text,to_jsonb(w) from workspace w union all
select 'app_config',key,to_jsonb(c) from app_config c where key='default_allowed_file_types';
insert into storage_hold(storage_key,reason)
select distinct r.storage_key,'Activity migration source archive'
from asset_resource r join activity_migrating_assets m on m.id=r.asset_id where r.storage_key is not null
on conflict(storage_key) do nothing;
insert into storage_hold(storage_key,reason)
select storage_key,'Activity migration source payload archive' from activity_archive_hold
on conflict(storage_key) do nothing;

-- Snapshot shop identity before converting its reusable image assets.
create temporary table activity_old_shops on commit drop as select * from asset where file_type='shop';
create temporary table activity_shop_rewards(old_asset_id uuid primary key,reward_asset_id uuid not null) on commit drop;
insert into activity_shop_rewards select a.id,gen_random_uuid() from activity_old_shops a
where exists(select 1 from asset_resource r where r.asset_id=a.id and r.role='checkin');
insert into asset(id,organization_id,origin_workspace_id,name,file_type,payload,created_by,maintained_by,
  visibility,state,origin,create_at,updated_at,archived_at,archived_by)
select m.reward_asset_id,a.organization_id,a.origin_workspace_id,coalesce(nullif(a.name,''),'店铺')||' · 打卡图','image',
  '{"kind":"image"}'::jsonb,a.created_by,a.maintained_by,a.visibility,a.state,a.origin,a.create_at,a.updated_at,a.archived_at,a.archived_by
from activity_shop_rewards m join activity_old_shops a on a.id=m.old_asset_id;
insert into asset_resource(asset_id,role,ordinal,storage_key,external_url,content_hash,mime_type,size_bytes)
select m.reward_asset_id,'primary',0,r.storage_key,r.external_url,r.content_hash,r.mime_type,r.size_bytes
from activity_shop_rewards m join asset_resource r on r.asset_id=m.old_asset_id and r.role='checkin';

-- One historical collection becomes one multi-point activity. A shared old image
-- can remain shared while each old map point retains its independent public ID.
do $$ declare
  group_row record; shop_row record; activity_uuid uuid; placement_uuid uuid; point_uuid uuid; point_order integer;
begin
  for group_row in select distinct w.id,w.organization_id,w.name,o.config
    from workspace w join organization o on o.id=w.organization_id
    join placement p on p.workspace_id=w.id join activity_old_shops a on a.id=p.asset_id order by w.id
  loop
    activity_uuid:=gen_random_uuid(); placement_uuid:=gen_random_uuid(); point_order:=0;
    insert into activity(id,organization_id,type,name,config)
      values(activity_uuid,group_row.organization_id,'shop_checkin',group_row.name||' · 店铺打卡','{"checkinRadiusMeters":50}');
    insert into activity_placement(id,activity_id,organization_id,workspace_id,status,config)
      values(placement_uuid,activity_uuid,group_row.organization_id,group_row.id,
        case when group_row.config->'shop_checkin_enabled'='true'::jsonb then 'active' else 'paused' end,
        '{}'::jsonb);
    for shop_row in select a.*,p.id old_placement_id,p.location,p.status placement_status,p.render_config,p.altitude,p.anchor_id,
        p.created_at placement_created_at,p.updated_at placement_updated_at,p.name placement_name,
        coalesce((select jsonb_agg(t.tag_id order by t.tag_id) from placement_tag t where t.placement_id=p.id),'[]'::jsonb) tag_ids,
        r.reward_asset_id
      from placement p join activity_old_shops a on a.id=p.asset_id left join activity_shop_rewards r on r.old_asset_id=a.id
      where p.workspace_id=group_row.id order by a.create_at desc nulls last,p.id
    loop
      point_uuid:=gen_random_uuid();
      insert into activity_point(id,activity_id,organization_id,name,description,ordinal,image_asset_id,reward_asset_id,state,created_at,updated_at)
        values(point_uuid,activity_uuid,group_row.organization_id,
          coalesce(nullif(shop_row.payload->>'name',''),nullif(shop_row.placement_name,''),nullif(shop_row.name,''),'店铺'),
          coalesce(shop_row.payload->>'text',shop_row.payload#>>'{migration_legacy,text_content}'),point_order,
          case when exists(select 1 from asset_resource where asset_id=shop_row.id and role='primary') then shop_row.id else null end,
          shop_row.reward_asset_id,'active',coalesce(shop_row.create_at,shop_row.placement_created_at),shop_row.updated_at);
      insert into activity_point_placement(id,placement_id,activity_id,organization_id,point_id,location,enabled,config,created_at,updated_at)
        values(shop_row.old_placement_id,placement_uuid,activity_uuid,group_row.organization_id,point_uuid,shop_row.location,
          shop_row.placement_status='active',jsonb_build_object('legacyAssetId',shop_row.id,'legacyStatus',shop_row.placement_status,
            'renderConfig',shop_row.render_config,'altitude',shop_row.altitude,'anchorId',shop_row.anchor_id,'tagIds',shop_row.tag_ids),
          shop_row.placement_created_at,shop_row.placement_updated_at);
      point_order:=point_order+1;
    end loop;
  end loop;
  for group_row in select distinct a.organization_id from activity_old_shops a
    where not exists(select 1 from placement p where p.asset_id=a.id) order by a.organization_id
  loop
    activity_uuid:=gen_random_uuid(); point_order:=0;
    insert into activity(id,organization_id,type,name,config)
      values(activity_uuid,group_row.organization_id,'shop_checkin','未投放店铺打卡','{"checkinRadiusMeters":50}');
    for shop_row in select a.*,r.reward_asset_id from activity_old_shops a
      left join activity_shop_rewards r on r.old_asset_id=a.id
      where a.organization_id=group_row.organization_id and not exists(select 1 from placement p where p.asset_id=a.id)
      order by a.create_at desc nulls last,a.id
    loop
      insert into activity_point(activity_id,organization_id,name,description,ordinal,image_asset_id,reward_asset_id,state,created_at,updated_at)
        values(activity_uuid,group_row.organization_id,coalesce(nullif(shop_row.payload->>'name',''),nullif(shop_row.name,''),'店铺'),
          coalesce(shop_row.payload->>'text',shop_row.payload#>>'{migration_legacy,text_content}'),point_order,
          case when exists(select 1 from asset_resource where asset_id=shop_row.id and role='primary') then shop_row.id else null end,
          shop_row.reward_asset_id,shop_row.state,coalesce(shop_row.create_at,now()),shop_row.updated_at);
      point_order:=point_order+1;
    end loop;
  end loop;
end $$;
delete from placement where asset_id in (select id from activity_old_shops);
delete from asset_resource where asset_id in (select id from activity_old_shops) and role='checkin';
update asset a set file_type='image',payload=(a.payload-'text'-'name')||'{"kind":"image"}'::jsonb
  where a.id in (select id from activity_old_shops);

-- Only maps with actual submitted messages receive a migrated danmaku activity.
-- New maps and empty historical maps require explicit activity authoring.
do $$ declare w record; activity_uuid uuid; placement_uuid uuid;
begin
  for w in select source_workspace.* from workspace source_workspace where exists (
    select 1 from asset a join activity_text_classification c on c.asset_id=a.id
    where c.decision='migrate' and (exists(select 1 from placement p where p.asset_id=a.id and p.workspace_id=source_workspace.id)
      or (a.origin_workspace_id=source_workspace.id and not exists(select 1 from placement p where p.asset_id=a.id)))
  ) order by source_workspace.id loop
    activity_uuid:=gen_random_uuid(); placement_uuid:=gen_random_uuid();
    insert into activity(id,organization_id,type,name,config)
      values(activity_uuid,w.organization_id,'danmaku',w.name||' · 弹幕留言','{"maxLength":500}');
    insert into activity_placement(id,activity_id,organization_id,workspace_id,status)
      values(placement_uuid,activity_uuid,w.organization_id,w.id,'active');
    insert into activity_record(id,organization_id,activity_id,placement_id,kind,content,location,status,metadata,render_config,created_at,updated_at)
      select p.id,w.organization_id,activity_uuid,placement_uuid,'danmaku',
        coalesce(a.payload->>'text',a.payload#>>'{migration_legacy,text_content}',''),p.location,
        case when p.status='active' then 'visible' else 'hidden' end,
        jsonb_build_object('legacyAssetId',a.id,'legacyStatus',p.status,'attributes',coalesce(a.payload->'attributes','{}'),
          'capture',a.payload->'capture','altitude',p.altitude,'anchorId',p.anchor_id,
          'tagIds',coalesce((select jsonb_agg(t.tag_id order by t.tag_id) from placement_tag t where t.placement_id=p.id),'[]'::jsonb)),
        p.render_config,coalesce(a.create_at,p.created_at),p.updated_at
      from placement p join asset a on a.id=p.asset_id join activity_text_classification c on c.asset_id=a.id
      where c.decision='migrate' and p.workspace_id=w.id;
    insert into activity_record(id,organization_id,activity_id,placement_id,kind,content,status,metadata,created_at,updated_at)
      select a.id,w.organization_id,activity_uuid,placement_uuid,'danmaku',
        coalesce(a.payload->>'text',a.payload#>>'{migration_legacy,text_content}',''),'hidden',
        jsonb_build_object('legacyAssetId',a.id,'attributes',coalesce(a.payload->'attributes','{}'),'capture',a.payload->'capture'),
        coalesce(a.create_at,now()),a.updated_at
      from asset a join activity_text_classification c on c.asset_id=a.id where c.decision='migrate'
        and a.origin_workspace_id=w.id and not exists(select 1 from placement p where p.asset_id=a.id);
  end loop;
end $$;
delete from placement where asset_id in (select asset_id from activity_text_classification where decision='migrate');
delete from asset where id in (select asset_id from activity_text_classification where decision='migrate');

-- Only image assets remain for migrated shops; new shop authoring is an activity.
update organization set allowed_file_types=array_remove(allowed_file_types,'shop'),config=config-'shop_checkin_enabled';
update app_config set value=value-'shop' where key='default_allowed_file_types' and jsonb_typeof(value)='array';
do $update_function$ begin
  execute replace(pg_get_functiondef('public.handle_new_user()'::regprocedure), $old$,'shop'$old$, '');
end $update_function$;


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

  -- Explicit purge of activity participation and definitions, in dependency order.
  delete from public.activity_record where organization_id = any(_org_ids);
  delete from public.activity_point_placement where organization_id = any(_org_ids);
  delete from public.activity_placement where organization_id = any(_org_ids);
  delete from public.activity_point where organization_id = any(_org_ids);
  delete from public.activity where organization_id = any(_org_ids);

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
