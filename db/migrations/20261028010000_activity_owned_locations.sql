-- Activity locations and participation rules are shared by every map deployment.
-- Run the read-only activity-location-preflight before a coordinated application cutover.
lock table activity, activity_point, activity_placement, activity_point_placement, activity_record in access exclusive mode;

create temporary table activity_location_conflicts on commit drop as
-- BEGIN ACTIVITY LOCATION CONFLICT QUERY
with rules as (
  select a.id activity_id,a.organization_id,p.id placement_id,p.workspace_id,
    a.type,a.config activity_config,p.config placement_config,
    case when a.type='shop_checkin' then 'checkinRadiusMeters' else 'maxLength' end rule_key,
    case when a.type='shop_checkin' then 50 else 500 end default_value
  from activity a join activity_placement p on p.activity_id=a.id
), effective_rules as (
  select *,coalesce(
    case when jsonb_typeof(placement_config->rule_key)='number' then
      case when (placement_config->>rule_key)::numeric between 1 and (case when type='shop_checkin' then 1000 else 500 end)
        and (type='shop_checkin' or (placement_config->>rule_key)::numeric=trunc((placement_config->>rule_key)::numeric))
      then (placement_config->>rule_key)::numeric end end,
    case when jsonb_typeof(activity_config->rule_key)='number' then
      case when (activity_config->>rule_key)::numeric between 1 and (case when type='shop_checkin' then 1000 else 500 end)
        and (type='shop_checkin' or (activity_config->>rule_key)::numeric=trunc((activity_config->>rule_key)::numeric))
      then (activity_config->>rule_key)::numeric end end,
    default_value) effective_value
  from rules
), point_availability as (
  -- A missing point relation previously made that point unavailable on this map.
  select point.id point_id,point.activity_id,point.organization_id,p.id placement_id,p.workspace_id,
    pp.id point_placement_id,coalesce(pp.enabled,false) enabled
  from activity_point point join activity_placement p on p.activity_id=point.activity_id
  left join activity_point_placement pp on pp.placement_id=p.id and pp.point_id=point.id
)
select 'point_location'::text kind,pp.organization_id,pp.activity_id,pp.point_id,
  jsonb_agg(jsonb_build_object('pointPlacementId',pp.id,'placementId',pp.placement_id,
    'longitude',st_x(pp.location),'latitude',st_y(pp.location)) order by pp.id) sources
from activity_point_placement pp where pp.location is not null
group by pp.organization_id,pp.activity_id,pp.point_id
having count(distinct jsonb_build_array(st_x(pp.location),st_y(pp.location)))>1
union all
select 'point_enabled',organization_id,activity_id,point_id,
  jsonb_agg(jsonb_build_object('placementId',placement_id,'workspaceId',workspace_id,
    'pointPlacementId',point_placement_id,'enabled',enabled) order by placement_id)
from point_availability group by organization_id,activity_id,point_id having count(distinct enabled)>1
union all
select 'effective_config',organization_id,activity_id,null::uuid,
  jsonb_agg(jsonb_build_object('placementId',placement_id,'workspaceId',workspace_id,
    'rule',rule_key,'effectiveValue',effective_value,'activityConfig',activity_config,'placementConfig',placement_config) order by placement_id)
from effective_rules group by organization_id,activity_id having count(distinct effective_value)>1
union all
select 'activity_center',organization_id,activity_id,null::uuid,
  jsonb_agg(jsonb_build_object('placementId',id,'workspaceId',workspace_id,
    'longitude',st_x(location),'latitude',st_y(location),'radiusMeters',radius_meters) order by id)
from activity_placement where location is not null group by organization_id,activity_id
having count(distinct jsonb_build_array(st_x(location),st_y(location)))>1
union all
select 'participation_area',organization_id,activity_id,null::uuid,
  jsonb_agg(jsonb_build_object('placementId',id,'workspaceId',workspace_id,
    'longitude',st_x(location),'latitude',st_y(location),'radiusMeters',radius_meters) order by id)
from activity_placement group by organization_id,activity_id
having count(distinct case when radius_meters is null then '"unbounded"'::jsonb
  else jsonb_build_array(st_x(location),st_y(location),radius_meters) end)>1
union all
select 'duplicate_association',organization_id,activity_id,null::uuid,
  jsonb_agg(jsonb_build_object('placementId',id,'workspaceId',workspace_id,'status',status) order by id)
from activity_placement group by organization_id,activity_id,workspace_id having count(*)>1
union all
select 'incomplete_area',organization_id,activity_id,null::uuid,
  jsonb_agg(jsonb_build_object('placementId',id,'workspaceId',workspace_id,
    'longitude',st_x(location),'latitude',st_y(location),'radiusMeters',radius_meters) order by id)
from activity_placement where (location is null) <> (radius_meters is null)
group by organization_id,activity_id
-- END ACTIVITY LOCATION CONFLICT QUERY
;

do $$
declare conflict_count integer; samples text;
begin
  select count(*) into conflict_count from activity_location_conflicts;
  if conflict_count>0 then
    select string_agg(kind||': activity='||activity_id::text||coalesce(' point='||point_id::text,''), '; ')
      into samples from (select * from activity_location_conflicts order by activity_id,point_id,kind limit 10) first_conflicts;
    raise exception 'Activity-owned locations migration blocked: % conflicting groups. Run scripts/db/activity-location-preflight.ts --output /private/path/activity-locations.json', conflict_count
      using detail=samples;
  end if;
end $$;

-- Keep exact source rows, including obsolete point-placement IDs and ignored legacy
-- display metadata, for traceability. Participation and asset/resource rows are untouched.
create table migration_archive.activity_location_source (
  source_table text not null,
  source_key text not null,
  row_data jsonb not null,
  captured_at timestamptz not null default now(),
  primary key(source_table,source_key)
);
insert into migration_archive.activity_location_source(source_table,source_key,row_data)
  select 'activity',id::text,to_jsonb(a) from activity a
  union all select 'activity_point',id::text,to_jsonb(p) from activity_point p
  union all select 'activity_placement',id::text,to_jsonb(p) from activity_placement p
  union all select 'activity_point_placement',id::text,to_jsonb(p) from activity_point_placement p;

alter table activity add column location geometry(Point,4326), add column radius_meters double precision,
  add constraint activity_radius_valid check (radius_meters>0 and radius_meters<'Infinity'::float8),
  add constraint activity_radius_location check ((radius_meters is null) = (location is null)),
  add constraint activity_location_valid check (location is null or (st_x(location) between -180 and 180 and st_y(location) between -90 and 90));
alter table activity_point add column location geometry(Point,4326),
  add constraint activity_point_location_valid check (location is null or (st_x(location) between -180 and 180 and st_y(location) between -90 and 90));
create index activity_location_idx on activity using gist(location);
create index activity_point_location_idx on activity_point using gist(location);

-- After conflict checks, every non-null location and every effective rule within
-- an activity agrees. Choosing one representative cannot discard a distinct value.
with source as (
  select a.id,a.type,a.config,coalesce(p.config,'{}'::jsonb) placement_config,
    case when a.type='shop_checkin' then 'checkinRadiusMeters' else 'maxLength' end rule_key,
    case when a.type='shop_checkin' then 50 else 500 end default_value
  from activity a left join lateral (select config from activity_placement where activity_id=a.id order by id limit 1) p on true
), resolved as (
  select *,coalesce(
    case when jsonb_typeof(placement_config->rule_key)='number' then
      case when (placement_config->>rule_key)::numeric between 1 and (case when type='shop_checkin' then 1000 else 500 end)
        and (type='shop_checkin' or (placement_config->>rule_key)::numeric=trunc((placement_config->>rule_key)::numeric))
      then (placement_config->>rule_key)::numeric end end,
    case when jsonb_typeof(config->rule_key)='number' then
      case when (config->>rule_key)::numeric between 1 and (case when type='shop_checkin' then 1000 else 500 end)
        and (type='shop_checkin' or (config->>rule_key)::numeric=trunc((config->>rule_key)::numeric))
      then (config->>rule_key)::numeric end end,
    default_value) effective_value
  from source
)
update activity a set config=jsonb_build_object(r.rule_key,r.effective_value),
  location=(select location from activity_placement where activity_id=a.id and location is not null order by id limit 1),
  radius_meters=(select radius_meters from activity_placement where activity_id=a.id and radius_meters is not null order by id limit 1)
from resolved r where r.id=a.id;

update activity_point p set
  location=(select location from activity_point_placement where point_id=p.id and location is not null order by id limit 1),
  state=case when exists(select 1 from activity_placement where activity_id=p.activity_id)
    and not exists(select 1 from activity_point_placement where point_id=p.id and enabled) then 'archived' else p.state end;

-- The remaining composite point FK enforces activity/team ownership. A fixed point
-- may now be checked in from any deployment of its activity, independently per map.
alter table activity_record drop constraint activity_record_deployed_point_fk;
drop table activity_point_placement;
alter table activity_placement drop column location, drop column radius_meters, drop column config;
alter table activity_placement add constraint activity_placement_activity_workspace_unique unique(activity_id,workspace_id);

-- The prior migration installed a purge function that refers to the removed table.
do $$
declare source text;
begin
  source:=pg_get_functiondef('public.purge_organizations(uuid[])'::regprocedure);
  if position('delete from public.activity_point_placement where organization_id = any(_org_ids);' in source)=0 then
    raise exception 'Unexpected purge_organizations definition; review before removing activity point placements';
  end if;
  execute replace(source,'  delete from public.activity_point_placement where organization_id = any(_org_ids);'||chr(10),'');
end $$;
