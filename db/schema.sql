-- Baseline schema for the self-hosted PostgreSQL 17 + PostGIS database.
--
-- This file is the single source of truth for the database structure. It was
-- derived from the Supabase project on 2026-10-01 (tables, constraints,
-- indexes and every custom function), minus the Supabase-specific pieces:
--   * auth.users is replaced by Better Auth's tables in the `auth` schema
--     (same UUIDs are migrated, so public.users.user_id values never change);
--   * no `anon` / `authenticated` / `service_role` grants and no RLS — every
--     permission check lives in the application (lib/permissions*.ts);
--   * the sign-up initialisation trigger now fires on auth.users instead of
--     Supabase's auth.users.
--
-- Apply with scripts/db/migrate.ts (fresh database) — it records the baseline
-- in schema_migrations and then applies db/migrations/*.sql in order.

create extension if not exists postgis;

create schema if not exists auth;

-- ───────────────────────── auth (Better Auth) ─────────────────────────
-- Column names are snake_case; lib/auth/server.ts maps Better Auth's camelCase
-- fields onto them. Table/column shapes must stay in sync with that mapping.

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth.session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index session_user_id_idx on auth.session (user_id);

create table auth.account (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  provider_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_user_id_idx on auth.account (user_id);
create unique index account_provider_account_idx on auth.account (provider_id, account_id);

create table auth.verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_identifier_idx on auth.verification (identifier);

-- ───────────────────────── public: types & tables ─────────────────────────

create type public.user_role as enum ('super_admin', 'user');

create table public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role public.user_role not null default 'user',
  created_at timestamptz default now(),
  email text,
  -- maintained by trg_session_touch_last_sign_in (was auth.users.last_sign_in_at)
  last_sign_in_at timestamptz
);

create table public.organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now(),
  created_by uuid references public.users(user_id) on delete set null,
  map_center jsonb,
  allowed_file_types text[],
  config jsonb not null default '{}'::jsonb
);

create table public.workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  create_date timestamptz default now(),
  organization_id uuid not null references public.organization(id)
);
create index idx_workspace_organization_id on public.workspace (organization_id);

create table public.organization_member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  role text not null default 'member'
    constraint organization_member_role_check
    check (role = any (array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])),
  created_at timestamptz default now(),
  constraint organization_member_org_user_unique unique (organization_id, user_id)
);
create index idx_organization_member_org_id on public.organization_member (organization_id);
create index idx_organization_member_user_id on public.organization_member (user_id);

create table public.organization_invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  workspace_id uuid references public.workspace(id) on delete cascade,
  token text not null unique,
  role text not null default 'member'
    constraint organization_invitation_role_check
    check (role = any (array['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])),
  created_by uuid,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked boolean not null default false,
  use_count integer not null default 0
);
create index idx_org_invitation_org on public.organization_invitation (organization_id);

create table public.workspace_assignment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint workspace_assignment_unique unique (user_id, workspace_id)
);

create table public.user_organization_pin (
  user_id uuid not null references public.users(user_id) on delete cascade,
  organization_id uuid not null references public.organization(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table public.tag (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#808080'::text,
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid references public.users(user_id) on delete set null,
  constraint tag_name_workspace_id_key unique (name, workspace_id)
);
create index idx_tag_workspace_id on public.tag (workspace_id);

create table public.asset (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users(user_id) on delete set null,
  create_at timestamptz default now(),
  file_type text not null,
  file_url text,
  text_content text,
  location geometry,
  metadata jsonb default '{}'::jsonb,
  workspace_id uuid[] default '{}'::uuid[],
  anchor_id uuid references public.asset(id) on delete set null,
  name text,
  tag_ids uuid[] default '{}'::uuid[],
  is_huge boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  content_hash text
);
create index asset_content_hash_idx on public.asset (content_hash);
create index idx_asset_tag_ids on public.asset using gin (tag_ids);
create index idx_asset_workspace_id_gin on public.asset using gin (workspace_id);

create table public.anchor_embedding (
  anchor_id uuid primary key references public.asset(id) on delete cascade,
  image_url text not null,
  image_sha256 text,
  generation uuid not null,
  status text not null
    constraint anchor_embedding_status_check
    check (status = any (array['pending'::text, 'ready'::text, 'failed'::text])),
  embedding real[],
  embedding_version text,
  updated_at timestamptz not null default now(),
  constraint anchor_embedding_check check (
    status <> 'ready'::text
    or (embedding is not null and array_ndims(embedding) = 1
        and cardinality(embedding) = 8448 and embedding_version is not null)
  )
);

create table public.anchor_match_rate_limit (
  workspace_id uuid primary key references public.workspace(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid,
  scope text,
  method text,
  path text,
  status integer,
  message text,
  context jsonb
);
create index idx_error_log_created_at on public.error_log (created_at desc);
create index idx_error_log_status on public.error_log (status);

-- ───────────────────────── functions ─────────────────────────

-- Sign-up initialisation: a public.users row, a personal organization with the
-- caller as owner, and a default workspace. Fires for every auth.users insert,
-- so Better Auth sign-ups, phone sign-ups and admin-created users all get the
-- same bootstrap.
create function public.handle_new_user() returns trigger
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

  insert into public.organization (name, created_by, allowed_file_types)
  values (
    coalesce(user_name, split_part(new.email, '@', 1)) || '''s Organization',
    new.id,
    default_types
  )
  returning id into new_org_id;

  insert into public.organization_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.workspace (name, organization_id)
  values ('Default Workspace', new_org_id);

  return new;
end;
$$;

-- Keep public.users.email in sync when the login email changes.
create function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.users set email = new.email where user_id = new.id;
  return new;
end;
$$;

-- Record the latest sign-in time (replaces auth.users.last_sign_in_at).
create function public.touch_last_sign_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.users set last_sign_in_at = new.created_at where user_id = new.user_id;
  return new;
end;
$$;

create function public.set_asset_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.validate_workspace_ids() returns trigger
language plpgsql as $$
begin
  if new.workspace_id is not null then
    if not (
      select bool_and(exists(
        select 1 from public.workspace where id = workspace_id
      ))
      from unnest(new.workspace_id) as workspace_id
    ) then
      raise exception 'One or more workspace_id values do not exist in workspace table';
    end if;
  end if;
  return new;
end;
$$;

-- Prevent self/nested/cross-workspace links. Existing rows remain untouched.
create function public.validate_asset_anchor() returns trigger
language plpgsql set search_path = public as $$
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

-- Drop cached reference features when the anchor image changes.
create function public.invalidate_anchor_embedding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.file_url is distinct from new.file_url or new.file_type <> 'anchor' then
    delete from public.anchor_embedding where anchor_id = new.id;
  end if;
  return new;
end;
$$;

create function public.move_assets(_moves jsonb) returns void
language plpgsql as $$
begin
  update public.asset a
  set
    metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_build_object(
      'longitude', (m->>'longitude')::float8,
      'latitude', (m->>'latitude')::float8,
      'height', (m->>'height')::float8
    ),
    location = ST_MakePoint(
      (m->>'longitude')::float8,
      (m->>'latitude')::float8
    )
  from jsonb_array_elements(_moves) as m
  where a.id = (m->>'assetId')::uuid;
end;
$$;

create function public.get_user_organizations(p_user_id uuid)
returns table(id uuid, name text, description text, created_at timestamptz, role text,
              map_center jsonb, allowed_file_types text[], pinned_at timestamptz)
language plpgsql as $$
declare
  v_user_role user_role;
begin
  select u.role into v_user_role
  from users u
  where u.user_id = p_user_id;

  if not found then
    return;
  end if;

  if v_user_role = 'super_admin' then
    return query
    select o.id, o.name, o.description, o.created_at,
      coalesce(om.role, 'super_admin') as role,
      o.map_center,
      o.allowed_file_types,
      p.pinned_at
    from organization o
    left join organization_member om
      on o.id = om.organization_id and om.user_id = p_user_id
    left join user_organization_pin p
      on o.id = p.organization_id and p.user_id = p_user_id
    order by o.created_at desc;
  else
    return query
    select o.id, o.name, o.description, o.created_at, om.role,
      o.map_center,
      o.allowed_file_types,
      p.pinned_at
    from organization o
    inner join organization_member om
      on o.id = om.organization_id
    left join user_organization_pin p
      on o.id = p.organization_id and p.user_id = p_user_id
    where om.user_id = p_user_id
    order by o.created_at desc;
  end if;
end;
$$;

create function public.get_user_workspaces(p_user_id uuid)
returns table(id uuid, name text, description text, create_date timestamptz, organization_id uuid)
language plpgsql as $$
declare
  v_user_role user_role;
begin
  select u.role into v_user_role from users u where u.user_id = p_user_id;

  if not found then
    return;
  end if;

  if v_user_role = 'super_admin' then
    return query
    select w.id, w.name, w.description, w.create_date, w.organization_id
    from workspace w
    order by w.create_date desc;
  else
    return query
    select distinct w.id, w.name, w.description, w.create_date, w.organization_id
    from workspace w
    inner join organization_member om on w.organization_id = om.organization_id
    where om.user_id = p_user_id
      and (
        om.role in ('owner', 'admin')
        or exists (
          select 1 from workspace_assignment wa
          where wa.workspace_id = w.id and wa.user_id = p_user_id
        )
      )
    order by w.create_date desc;
  end if;
end;
$$;

-- Promote the best successor to owner in each org the leaving user solely owns.
create function public.promote_owner_successors(_org_ids uuid[], _excluding_user uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  _promoted integer;
begin
  with ranked as (
    select om.id,
           row_number() over (
             partition by om.organization_id
             order by (om.role = 'admin') desc, om.created_at asc, om.id asc
           ) as rn
    from public.organization_member om
    where om.organization_id = any(_org_ids)
      and om.user_id <> _excluding_user
      and om.role <> 'owner'
      -- 已有其他 owner 的组织无需晋升
      and not exists (
        select 1 from public.organization_member o2
        where o2.organization_id = om.organization_id
          and o2.role = 'owner'
          and o2.user_id <> _excluding_user
      )
  )
  update public.organization_member m
  set role = 'owner'
  from ranked r
  where m.id = r.id and r.rn = 1;

  get diagnostics _promoted = row_count;
  return _promoted;
end;
$$;

-- Atomically delete organizations with their workspaces and contained assets.
create function public.purge_organizations(_org_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _ws_ids uuid[];
  _deleted_assets integer := 0;
  _stripped_assets integer := 0;
  _deleted_workspaces integer := 0;
  _deleted_orgs integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into _ws_ids
  from public.workspace
  where organization_id = any(_org_ids);

  if array_length(_ws_ids, 1) is not null then
    -- 完全包含在被删 workspace 集合内的资产：删行
    -- （空数组 <@ 任何集合都为真，须排除，避免误删已无归属的资产）
    delete from public.asset
    where workspace_id is not null
      and workspace_id <> '{}'::uuid[]
      and workspace_id <@ _ws_ids;
    get diagnostics _deleted_assets = row_count;

    -- 跨组织资产：只从数组里剥离被删的 workspace id
    update public.asset
    set workspace_id = (
      select coalesce(array_agg(w), '{}'::uuid[])
      from unnest(workspace_id) as w
      where w <> all(_ws_ids)
    )
    where workspace_id && _ws_ids;
    get diagnostics _stripped_assets = row_count;

    -- 级联 tag / workspace_assignment / organization_invitation(workspace_id)
    delete from public.workspace where id = any(_ws_ids);
    get diagnostics _deleted_workspaces = row_count;
  end if;

  -- 级联 organization_member / organization_invitation(organization_id)
  delete from public.organization where id = any(_org_ids);
  get diagnostics _deleted_orgs = row_count;

  return jsonb_build_object(
    'deleted_assets', _deleted_assets,
    'stripped_assets', _stripped_assets,
    'deleted_workspaces', _deleted_workspaces,
    'deleted_orgs', _deleted_orgs
  );
end;
$$;

create function public.error_log_query(
  p_scope text default null, p_status_class text default null, p_q text default null,
  p_from timestamptz default null, p_to timestamptz default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb
language sql stable as $$
  with f as (
    select *
    from public.error_log e
    where (p_scope is null or e.scope = p_scope)
      and (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at < p_to)
      and (
        p_q is null
        or e.message ilike '%' || p_q || '%'
        or e.path ilike '%' || p_q || '%'
      )
      and (
        p_status_class is null
        or (p_status_class = 'zero' and e.status = 0)
        or (p_status_class = '4xx' and e.status between 400 and 499)
        or (p_status_class = '5xx' and e.status between 500 and 599)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select id, created_at, user_id, scope, method, path, status,
               message, context
        from f
        order by created_at desc
        limit greatest(p_limit, 0)
        offset greatest(p_offset, 0)
      ) t
    ),
    'stats', jsonb_build_object(
      'byScope', (
        select coalesce(jsonb_object_agg(scope, c), '{}'::jsonb)
        from (
          select coalesce(scope, 'unknown') as scope, count(*) as c
          from f group by 1
        ) s
      ),
      'byStatusClass', jsonb_build_object(
        'zero', (select count(*) from f where status = 0),
        '4xx', (select count(*) from f where status between 400 and 499),
        '5xx', (select count(*) from f where status between 500 and 599),
        'other', (
          select count(*) from f
          where status is null
             or (status <> 0 and not (status between 400 and 599))
        )
      ),
      'topPaths', (
        select coalesce(
          jsonb_agg(jsonb_build_object('path', path, 'count', c) order by c desc),
          '[]'::jsonb
        )
        from (
          select coalesce(path, '—') as path, count(*) as c
          from f group by 1 order by c desc limit 8
        ) p
      ),
      'daily', (
        select coalesce(
          jsonb_agg(jsonb_build_object('day', day, 'count', c) order by day),
          '[]'::jsonb
        )
        from (
          select date_trunc('day', created_at)::date as day, count(*) as c
          from f group by 1 order by 1
        ) d
      )
    )
  );
$$;

-- ── anchor matching (see docs/anchor-matching.md) ──

create function public.begin_anchor_embedding(p_anchor_id uuid, p_image_url text, p_generation uuid) returns boolean
language plpgsql set search_path = public as $$
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

create function public.consume_anchor_match_request(p_workspace_id uuid, p_limit integer default 120) returns boolean
language plpgsql set search_path = public as $$
declare used integer;
begin
  insert into public.anchor_match_rate_limit as r values(p_workspace_id,clock_timestamp(),1)
  on conflict(workspace_id) do update set
    request_count=case when r.window_start < clock_timestamp()-interval '1 minute' then 1 else r.request_count+1 end,
    window_start=case when r.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else r.window_start end
  returning request_count into used;
  return used <= p_limit;
end;
$$;

create function public.find_nearby_matching_anchors(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision)
returns table(id uuid, name text, file_url text, metadata jsonb, distance_meters double precision)
language sql stable set search_path = public as $$
  select a.id, a.name::text, a.file_url::text, a.metadata::jsonb,
    ST_Distance(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography)
  from public.asset a
  where a.file_type='anchor' and a.file_url is not null and a.location is not null
    and a.workspace_id @> array[p_workspace_id]
    and ST_DWithin(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography, least(greatest(p_radius,0),200))
  order by 5, a.id limit 201;
$$;

create function public.read_anchor_match_context(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision)
returns table(id uuid, name text, file_url text, distance_meters double precision, reference_image_url text,
              reference_status text, embedding_version text, embedding real[], reference_snapshot jsonb)
language sql stable set search_path = public as $$
  select c.id, c.name, c.file_url, c.distance_meters,
    e.image_url, e.status, e.embedding_version, e.embedding,
    jsonb_build_object(
      'id', c.id, 'file_url', c.file_url,
      'location', encode(ST_AsEWKB(a.location::geometry), 'hex'),
      'reference_generation', e.generation, 'reference_status', e.status,
      'reference_image_url', e.image_url, 'embedding_version', e.embedding_version,
      'reference_updated_at', e.updated_at, 'reference_sha256', e.image_sha256
    )
  from public.find_nearby_matching_anchors(p_workspace_id, p_lat, p_lng, p_radius) c
  join public.asset a on a.id = c.id
  left join public.anchor_embedding e on e.anchor_id = c.id;
$$;

create function public.prepare_anchor_match_context(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision) returns jsonb
language plpgsql set search_path = public as $$
declare result jsonb;
begin
  if not public.consume_anchor_match_request(p_workspace_id) then
    return jsonb_build_object('allowed', false, 'candidates', '[]'::jsonb, 'reference_snapshot', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'allowed', true,
    'candidates', coalesce(jsonb_agg(to_jsonb(c) - 'reference_snapshot' order by c.id), '[]'::jsonb),
    'reference_snapshot', coalesce(jsonb_agg(c.reference_snapshot order by c.id), '[]'::jsonb)
  ) into result
  from public.read_anchor_match_context(p_workspace_id, p_lat, p_lng, p_radius) c;
  return result;
end;
$$;

create function public.finalize_anchor_match(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision, p_anchor_id uuid, p_reference_snapshot jsonb) returns jsonb
language sql stable set search_path = public as $$
  with current_candidates as materialized (
    select c.id, c.reference_snapshot
    from public.read_anchor_match_context(p_workspace_id, p_lat, p_lng, p_radius) c
  ), checked as (
    select coalesce(
      count(*) between 1 and 200
      and bool_or(id = p_anchor_id)
      and jsonb_agg(reference_snapshot order by id) = p_reference_snapshot,
      false
    ) as unchanged
    from current_candidates
  )
  select jsonb_build_object(
    'unchanged', checked.unchanged,
    'assets', case when checked.unchanged then (
      select coalesce(jsonb_agg(to_jsonb(child) order by child.id), '[]'::jsonb)
      from (
        select a.id, a.name, a.file_type, a.file_url, a.text_content, a.anchor_id,
          a.tag_ids, a.metadata, a.is_huge, a.config
        from public.asset a
        where a.anchor_id = p_anchor_id and a.file_type <> 'anchor'
          and a.workspace_id @> array[p_workspace_id]
      ) child
    ) else '[]'::jsonb end
  ) from checked;
$$;

-- ── mini-program read/write functions (called by xr-frame-plant-trees) ──

create function public.get_nearby_assets(user_lat double precision, user_lng double precision, max_distance_meters double precision, p_workspace_id uuid default null, p_organization_id uuid default null)
returns table(id uuid, file_type text, file_url text, text_content text, metadata jsonb, config jsonb, is_huge boolean, distance double precision)
language plpgsql as $$
begin
  return query
  select
    a.id,
    a.file_type,
    a.file_url,
    a.text_content,
    a.metadata,
    a.config,
    a.is_huge,
    ST_Distance(
      a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) as distance
  from asset a
  join workspace w on a.workspace_id @> array[w.id]
  where
    (p_workspace_id is null or w.id = p_workspace_id)
    and (p_organization_id is null or w.organization_id = p_organization_id)
    and a.location is not null
    and ST_DWithin(
      a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      max_distance_meters
    )
  order by distance;
end;
$$;

create function public.get_huge_assets(p_workspace_id uuid default null, p_organization_id uuid default null)
returns table(id uuid, file_type text, file_url text, text_content text, metadata jsonb, config jsonb, latitude double precision, longitude double precision)
language plpgsql as $$
begin
  return query
  select
    a.id,
    a.file_type,
    a.file_url,
    a.text_content,
    a.metadata,
    a.config,
    ST_Y(a.location::geometry) as latitude,
    ST_X(a.location::geometry) as longitude
  from asset a
  join workspace w on a.workspace_id @> array[w.id]
  where
    (
      -- 有 workspace_id：同时用 org + workspace 双重约束
      (p_workspace_id is not null and p_organization_id is not null
        and w.id = p_workspace_id and w.organization_id = p_organization_id)
      or
      -- 只有 org（workspace=null）：返回该 org 下所有 workspace 的数据
      (p_workspace_id is null and p_organization_id is not null
        and w.organization_id = p_organization_id)
    )
    and a.is_huge = true
    and a.file_type = 'model'
    and a.location is not null;
end;
$$;

create function public.get_shop_assets(p_workspace_id uuid, p_organization_id uuid)
returns table(id uuid, name text, file_url text, text_content text, anchor_id uuid, tag_ids uuid[], metadata jsonb, longitude double precision, latitude double precision, create_at timestamptz)
language sql stable security definer as $$
  select
    a.id,
    a.name,
    a.file_url,
    a.text_content,
    a.anchor_id,
    a.tag_ids,
    a.metadata,
    ST_X(a.location::geometry)  as longitude,
    ST_Y(a.location::geometry)  as latitude,
    a.create_at
  from asset a
  join workspace w
    on w.id = p_workspace_id
   and w.organization_id = p_organization_id
  where a.file_type = 'shop'
    and p_workspace_id = any(a.workspace_id)
  order by a.create_at desc;
$$;

create function public.upload_text_asset(content text, p_workspace_id uuid, p_organization_id uuid default null, user_lng double precision default null, user_lat double precision default null, p_metadata jsonb default null) returns json
language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_result json;
  v_metadata jsonb;
begin
  -- 验证 workspace 存在且属于指定 organization
  if not exists (
    select 1 from workspace
    where id = p_workspace_id
      and (p_organization_id is null or organization_id = p_organization_id)
  ) then
    raise exception 'Workspace not found or does not belong to the specified organization';
  end if;

  -- 获取 dongming@user.com 的用户ID
  select user_id into v_user_id from users where email = 'dongming@user.com';

  if v_user_id is null then
    raise exception 'No user found in database';
  end if;

  -- 构建 metadata：如果传入了 p_metadata 则使用，否则根据坐标自动构建
  if p_metadata is not null then
    v_metadata := p_metadata;
  elsif user_lng is not null and user_lat is not null then
    v_metadata := jsonb_build_object(
      'longitude', user_lng,
      'latitude', user_lat,
      'gps_source', 'user_input',
      'upload_time', now()
    );
  else
    v_metadata := null;
  end if;

  -- 插入素材
  insert into asset (
    file_type,
    text_content,
    workspace_id,
    location,
    metadata,
    created_by
  )
  values (
    'text',
    content,
    array[p_workspace_id],
    case
      when user_lng is not null and user_lat is not null
      then ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
      else null
    end,
    v_metadata,
    v_user_id
  )
  returning json_build_object(
    'id', id,
    'file_type', file_type,
    'text_content', text_content,
    'metadata', metadata,
    'create_at', create_at
  ) into v_result;

  return v_result;
end;
$$;

-- ───────────────────────── triggers ─────────────────────────

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_user_email();

create trigger trg_session_touch_last_sign_in after insert on auth.session
  for each row execute function public.touch_last_sign_in();

create trigger trg_asset_set_updated_at before update on public.asset
  for each row execute function public.set_asset_updated_at();

create trigger validate_asset_workspace_ids before insert or update on public.asset
  for each row execute function public.validate_workspace_ids();

create trigger validate_asset_anchor before insert or update of anchor_id, workspace_id, file_type on public.asset
  for each row execute function public.validate_asset_anchor();

create trigger invalidate_anchor_embedding after update of file_url, file_type on public.asset
  for each row execute function public.invalidate_anchor_embedding();

-- ───────────────────────── seed ─────────────────────────

insert into public.app_config (key, value) values
  ('default_allowed_file_types', '["image","video","audio","link","text","anchor","shop"]'::jsonb)
on conflict (key) do nothing;

-- ───────────────────────── migration bookkeeping ─────────────────────────

create table public.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
insert into public.schema_migrations (name) values ('schema.sql');
