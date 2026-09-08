begin;
-- User-requested reset: every anchor present when this migration runs is legacy.
-- Detach children FIRST; delete only anchor rows, never their attached assets.
-- Run before deploying the new management UI. Entire migration rolls back on error.
update public.asset set anchor_id=null where anchor_id in (select id from public.asset where file_type='anchor');
delete from public.asset where file_type='anchor';

-- Matching points keep asset.file_type='anchor'; one reference image in file_url.
-- Embeddings are private derived data, never included in existing asset SELECT *.
create table public.anchor_embedding (
  anchor_id uuid primary key references public.asset(id) on delete cascade,
  image_url text not null,
  image_sha256 text,
  generation uuid not null,
  status text not null check (status in ('pending','ready','failed')),
  embedding real[],
  embedding_version text,
  updated_at timestamptz not null default now(),
  check (status <> 'ready' or (embedding is not null and array_ndims(embedding)=1 and cardinality(embedding)=8448 and embedding_version is not null))
);
alter table public.anchor_embedding enable row level security;
revoke all on public.anchor_embedding from anon, authenticated;
grant all on public.anchor_embedding to service_role;

create function public.invalidate_anchor_embedding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.file_url is distinct from new.file_url or new.file_type <> 'anchor' then
    delete from public.anchor_embedding where anchor_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_anchor_embedding() from public;
create trigger invalidate_anchor_embedding after update of file_url, file_type on public.asset
for each row execute function public.invalidate_anchor_embedding();

-- Prevent self/nested/cross-workspace links, including direct REST writes.
-- Existing rows remain untouched. API edits also validate with friendly errors.
create function public.validate_asset_anchor() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.anchor_id is not null and (
    new.file_type = 'anchor' or new.anchor_id = new.id or
    coalesce(cardinality(new.workspace_id),0)=0 or not exists (
      select 1 from public.asset parent where parent.id=new.anchor_id
      and parent.file_type='anchor' and new.workspace_id <@ parent.workspace_id
    )
  ) then raise exception 'Matching point must be an anchor in every child workspace' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger validate_asset_anchor before insert or update of anchor_id, workspace_id, file_type on public.asset
for each row execute function public.validate_asset_anchor();

-- Location in the current application uses SRID 0 POINT(lng lat); set 4326
-- explicitly before metre-distance calculations. Coordinates are WGS84.
create function public.find_nearby_matching_anchors(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision)
returns table(id uuid, name text, file_url text, metadata jsonb, distance_meters double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select a.id, a.name::text, a.file_url::text, a.metadata::jsonb,
    ST_Distance(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography)
  from public.asset a
  where a.file_type='anchor' and a.file_url is not null and a.location is not null
    and a.workspace_id @> array[p_workspace_id]
    and ST_DWithin(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography, least(greatest(p_radius,0),200))
  order by 5, a.id limit 201;
$$;
revoke all on function public.find_nearby_matching_anchors(uuid,double precision,double precision,double precision) from public, anon, authenticated;
grant execute on function public.find_nearby_matching_anchors(uuid,double precision,double precision,double precision) to service_role;

-- Shared limit across app replicas; fixed rows per workspace, no unbounded IP log.
create table public.anchor_match_rate_limit (
  workspace_id uuid primary key references public.workspace(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null
);
alter table public.anchor_match_rate_limit enable row level security;
revoke all on public.anchor_match_rate_limit from anon, authenticated;
grant all on public.anchor_match_rate_limit to service_role;
create function public.consume_anchor_match_request(p_workspace_id uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
declare used integer;
begin
  insert into public.anchor_match_rate_limit as r values(p_workspace_id,clock_timestamp(),1)
  on conflict(workspace_id) do update set
    request_count=case when r.window_start < clock_timestamp()-interval '1 minute' then 1 else r.request_count+1 end,
    window_start=case when r.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else r.window_start end
  returning request_count into used;
  return used <= 30;
end;
$$;
revoke all on function public.consume_anchor_match_request(uuid) from public, anon, authenticated;
grant execute on function public.consume_anchor_match_request(uuid) to service_role;

-- Serialize with reference-image changes, so a delayed old request cannot
-- overwrite features already prepared for a newer image.
create function public.begin_anchor_embedding(p_anchor_id uuid,p_image_url text,p_generation uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
declare current_url text; current_type text;
begin
  select file_url,file_type into current_url,current_type from public.asset where id=p_anchor_id for update;
  if not found or current_type <> 'anchor' or current_url is distinct from p_image_url then return false; end if;
  insert into public.anchor_embedding(anchor_id,image_url,generation,status)
  values(p_anchor_id,p_image_url,p_generation,'pending')
  on conflict(anchor_id) do update set image_url=excluded.image_url,generation=excluded.generation,status='pending',
    embedding=null,embedding_version=null,image_sha256=null,updated_at=clock_timestamp();
  return true;
end;
$$;
revoke all on function public.begin_anchor_embedding(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.begin_anchor_embedding(uuid,text,uuid) to service_role;

commit;
