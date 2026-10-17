-- Content model v2 foundation (docs/team-assets-scenes-refactor-plan.md §4, §5, §8).
--
-- Additive only: new columns/tables/constraints, the project-role backfill of
-- workspace_assignment (old text is kept in legacy_role), and guarded versions
-- of the legacy mini-program functions. No asset/scene/placement data is
-- backfilled here — that is the retryable migration tooling's job.
--
-- db/schema.sql carries the same structures and records this file in
-- schema_migrations, so a fresh database never re-applies it.

-- ── 0. refuse to run over leftover experimental tables (plan §8.4) ──
do $$
declare
  t text;
begin
  foreach t in array array[
    'asset_workspace_grant', 'asset_version', 'asset_version_resource', 'upload_receipt',
    'scene', 'scene_asset_ref', 'scene_revision', 'scene_revision_asset_ref',
    'placement', 'placement_tag', 'content_audit_log', 'content_command_idempotency',
    'content_migration_run', 'content_migration_map', 'legacy_runtime_binding', 'legacy_content_map',
    -- names used by the 2026-10-11 scene experiment
    'scene_revision_resource', 'legacy_scene_map'
  ] loop
    if to_regclass('public.' || t) is not null then
      raise exception 'table public.% already exists: export, inspect and isolate it before applying the content model migration', t;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workspace' and column_name = 'spatial_content_mode')
     or to_regprocedure('public.set_scene_updated_at()') is not null then
    raise exception 'scene experiment leftovers (workspace.spatial_content_mode / set_scene_updated_at) exist: isolate them first';
  end if;
end;
$$;

-- ── 1. organization: cutover state + archive ──
alter table public.organization
  add column content_model_state text not null default 'legacy'
    constraint organization_content_model_state_check
    check (content_model_state = any (array['legacy'::text, 'preparing'::text, 'readonly'::text, 'v2'::text])),
  add column content_model_changed_at timestamptz,
  add column archived_at timestamptz;

-- ── 2. workspace (= project): archive + composite key for same-org FKs ──
alter table public.workspace
  add column archived_at timestamptz,
  add column archived_by uuid references public.users(user_id) on delete set null,
  add constraint workspace_id_organization_unique unique (id, organization_id);

-- ── 3. tag: composite key so placement tags stay inside one project ──
alter table public.tag
  add constraint tag_id_workspace_unique unique (id, workspace_id);

-- ── 4. migration ledger (needed by the assignment backfill below) ──
create table public.content_migration_run (
  id uuid primary key default gen_random_uuid(),
  phase text not null
    constraint content_migration_run_phase_check
    check (phase = any (array['audit'::text, 'backfill'::text, 'verify'::text, 'cutover'::text, 'rollback'::text, 'schema'::text])),
  status text not null default 'running'
    constraint content_migration_run_status_check
    check (status = any (array['running'::text, 'staged'::text, 'completed'::text, 'failed'::text, 'aborted'::text])),
  organization_ids uuid[] not null default '{}'::uuid[],
  created_by uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  notes jsonb not null default '{}'::jsonb
);

create table public.content_migration_map (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.content_migration_run(id) on delete set null,
  source_kind text not null
    constraint content_migration_map_source_kind_check
    check (source_kind = any (array['asset'::text, 'scene_asset'::text, 'shop'::text, 'anchor'::text, 'text'::text, 'workspace_assignment'::text, 'tag'::text])),
  source_id uuid not null,
  source_workspace_id uuid,
  source_row_hash text not null,
  target_organization_id uuid,
  target_kind text
    constraint content_migration_map_target_kind_check
    check (target_kind is null or target_kind = any (array['asset'::text, 'asset_version'::text, 'scene'::text, 'scene_revision'::text, 'placement'::text, 'binding'::text, 'assignment'::text])),
  target_id uuid,
  status text not null
    constraint content_migration_map_status_check
    check (status = any (array['planned'::text, 'staged'::text, 'applied'::text, 'quarantined'::text, 'skipped'::text, 'failed'::text])),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_migration_map_unique unique nulls not distinct (source_kind, source_id, target_organization_id, target_kind)
);
create index content_migration_map_run_idx on public.content_migration_map (run_id);

-- ── 5. workspace_assignment.role → manager/editor/viewer (plan §5.1 M1) ──
alter table public.workspace_assignment add column legacy_role text;
update public.workspace_assignment set legacy_role = role;

-- Fail closed (plan §5.1 M1). Only the recognized old texts keep a meaning:
--   member / editor → editor, viewer → viewer, always capped by an org viewer.
-- Any other text (custom, manager, admin, …) and assignments of users who are
-- not members of the organization become viewer and are quarantined with a
-- reason for review; legacy_role keeps the original text. Owner/admin are
-- implicit managers, so an explicit row never limits them.
insert into public.content_migration_map
  (source_kind, source_id, source_workspace_id, source_row_hash, target_organization_id, target_kind, target_id, status, reason)
select 'workspace_assignment', wa.id, wa.workspace_id, md5(row(wa.*)::text), w.organization_id, 'assignment', wa.id, 'quarantined',
       case
         when om.user_id is null then 'assignment user is not a member of the workspace organization; demoted to viewer'
         else format('unrecognized legacy assignment role %L; demoted to viewer pending review', wa.legacy_role)
       end
from public.workspace_assignment wa
join public.workspace w on w.id = wa.workspace_id
left join public.organization_member om on om.organization_id = w.organization_id and om.user_id = wa.user_id
where om.user_id is null
   or wa.legacy_role is null
   or wa.legacy_role not in ('member', 'editor', 'viewer');

update public.workspace_assignment wa
set role = case
  when m.org_role is null then 'viewer'
  when wa.legacy_role is null or wa.legacy_role not in ('member', 'editor', 'viewer') then 'viewer'
  when m.org_role = 'viewer' or wa.legacy_role = 'viewer' then 'viewer'
  else 'editor'
end
from (
  select a.id, om.role as org_role
  from public.workspace_assignment a
  join public.workspace w on w.id = a.workspace_id
  left join public.organization_member om on om.organization_id = w.organization_id and om.user_id = a.user_id
) m
where m.id = wa.id;

alter table public.workspace_assignment
  alter column role set default 'editor',
  add constraint workspace_assignment_role_check
    check (role = any (array['manager'::text, 'editor'::text, 'viewer'::text]));

-- ── 6. asset identity columns ──
alter table public.asset
  add column organization_id uuid references public.organization(id),
  add column origin_workspace_id uuid,
  add column maintained_by uuid references public.users(user_id) on delete set null,
  add column visibility text not null default 'restricted'
    constraint asset_visibility_check
    check (visibility = any (array['restricted'::text, 'organization'::text])),
  add column state text not null default 'active'
    constraint asset_state_check
    check (state = any (array['active'::text, 'archived'::text])),
  add column current_version_id uuid,
  add column lock_version integer not null default 1,
  add column origin text not null default 'legacy'
    constraint asset_origin_check
    check (origin = any (array['team_upload'::text, 'public_submission'::text, 'legacy'::text])),
  add column archived_at timestamptz,
  add column archived_by uuid references public.users(user_id) on delete set null,
  add constraint asset_id_organization_unique unique (id, organization_id),
  add constraint asset_origin_workspace_fk foreign key (origin_workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete set null (origin_workspace_id);
create index asset_organization_id_idx on public.asset (organization_id) where organization_id is not null;

create table public.asset_workspace_grant (
  asset_id uuid not null,
  workspace_id uuid not null,
  organization_id uuid not null,
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (asset_id, workspace_id),
  constraint asset_workspace_grant_asset_fk foreign key (asset_id, organization_id)
    references public.asset(id, organization_id) on delete restrict,
  constraint asset_workspace_grant_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete restrict
);
create index asset_workspace_grant_workspace_idx on public.asset_workspace_grant (workspace_id);

-- ── 7. immutable versions and their explicit file lists ──
create table public.asset_version (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  organization_id uuid not null,
  version_no integer not null constraint asset_version_version_no_check check (version_no > 0),
  payload_schema_version integer not null default 1,
  payload jsonb not null constraint asset_version_payload_check check (jsonb_typeof(payload) = 'object'),
  created_by uuid,
  created_at timestamptz not null default now(),
  source_fingerprint text,
  constraint asset_version_asset_fk foreign key (asset_id, organization_id)
    references public.asset(id, organization_id) on delete restrict,
  constraint asset_version_asset_no_unique unique (asset_id, version_no),
  constraint asset_version_id_asset_unique unique (id, asset_id),
  constraint asset_version_id_organization_unique unique (id, organization_id)
);
create unique index asset_version_source_fingerprint_idx
  on public.asset_version (asset_id, source_fingerprint) where source_fingerprint is not null;

create table public.asset_version_resource (
  asset_version_id uuid not null references public.asset_version(id) on delete cascade,
  role text not null
    constraint asset_version_resource_role_check
    check (role = any (array['primary'::text, 'thumbnail'::text, 'checkin'::text, 'audio_compat'::text, 'reference'::text])),
  ordinal integer not null default 0 constraint asset_version_resource_ordinal_check check (ordinal >= 0),
  storage_key text,
  external_url text,
  content_hash text,
  mime_type text,
  size_bytes integer constraint asset_version_resource_size_check check (size_bytes is null or size_bytes >= 0),
  primary key (asset_version_id, role, ordinal),
  constraint asset_version_resource_target_check check (num_nonnulls(storage_key, external_url) = 1),
  constraint asset_version_resource_key_check check (
    storage_key is null
    or (length(storage_key) between 1 and 1024 and storage_key !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and storage_key !~ '(^|/)\.\.(/|$)' and storage_key !~ '^/')
  ),
  constraint asset_version_resource_url_check check (external_url is null or external_url ~ '^https?://')
);
create index asset_version_resource_storage_key_idx
  on public.asset_version_resource (storage_key) where storage_key is not null;

alter table public.asset
  add constraint asset_current_version_fk foreign key (current_version_id, id)
    references public.asset_version(id, asset_id);

-- Upload receipts: a time-limited lease that binds actor, organization,
-- object key, hash and purpose (plan §7). Active receipts protect their key.
create table public.upload_receipt (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  created_by uuid not null,
  storage_key text not null,
  content_hash text not null,
  mime_type text,
  size_bytes integer not null constraint upload_receipt_size_check check (size_bytes >= 0),
  upload_type text,
  purpose text not null
    constraint upload_receipt_purpose_check
    check (purpose = any (array['asset_version'::text, 'anchor_reference'::text, 'legacy_asset'::text])),
  reused boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint upload_receipt_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete cascade
);
create index upload_receipt_storage_key_idx on public.upload_receipt (storage_key);
create index upload_receipt_org_hash_idx on public.upload_receipt (organization_id, content_hash);

-- ── 8. scenes: mutable draft + immutable published revisions ──
create table public.scene (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  name text not null constraint scene_name_check check (length(btrim(name)) between 1 and 200),
  draft_document jsonb not null constraint scene_draft_document_check check (jsonb_typeof(draft_document) = 'object'),
  lock_version integer not null default 1,
  state text not null default 'active'
    constraint scene_state_check check (state = any (array['active'::text, 'archived'::text])),
  created_by uuid references public.users(user_id) on delete set null,
  updated_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  legacy_asset_id uuid,
  constraint scene_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete restrict,
  constraint scene_id_organization_unique unique (id, organization_id)
);
create index scene_workspace_idx on public.scene (workspace_id);

create table public.scene_asset_ref (
  scene_id uuid not null,
  organization_id uuid not null,
  resource_alias text not null,
  asset_id uuid not null,
  asset_version_id uuid not null,
  primary key (scene_id, resource_alias),
  constraint scene_asset_ref_scene_fk foreign key (scene_id, organization_id)
    references public.scene(id, organization_id) on delete cascade,
  constraint scene_asset_ref_asset_fk foreign key (asset_id, organization_id)
    references public.asset(id, organization_id) on delete restrict,
  constraint scene_asset_ref_version_fk foreign key (asset_version_id, asset_id)
    references public.asset_version(id, asset_id) on delete restrict
);
create index scene_asset_ref_asset_idx on public.scene_asset_ref (asset_id);
create index scene_asset_ref_version_idx on public.scene_asset_ref (asset_version_id);

create table public.scene_revision (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null,
  organization_id uuid not null,
  revision_no integer not null constraint scene_revision_revision_no_check check (revision_no > 0),
  source_lock_version integer not null,
  name text not null,
  document jsonb not null constraint scene_revision_document_check check (jsonb_typeof(document) = 'object'),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint scene_revision_scene_fk foreign key (scene_id, organization_id)
    references public.scene(id, organization_id) on delete restrict,
  constraint scene_revision_scene_no_unique unique (scene_id, revision_no),
  constraint scene_revision_source_lock_unique unique (scene_id, source_lock_version),
  constraint scene_revision_id_organization_unique unique (id, organization_id)
);

create table public.scene_revision_asset_ref (
  scene_revision_id uuid not null,
  organization_id uuid not null,
  resource_alias text not null,
  asset_id uuid not null,
  asset_version_id uuid not null,
  primary key (scene_revision_id, resource_alias),
  constraint scene_revision_asset_ref_revision_fk foreign key (scene_revision_id, organization_id)
    references public.scene_revision(id, organization_id) on delete cascade,
  constraint scene_revision_asset_ref_asset_fk foreign key (asset_id, organization_id)
    references public.asset(id, organization_id) on delete restrict,
  constraint scene_revision_asset_ref_version_fk foreign key (asset_version_id, asset_id)
    references public.asset_version(id, asset_id) on delete restrict
);
create index scene_revision_asset_ref_asset_idx on public.scene_revision_asset_ref (asset_id);
create index scene_revision_asset_ref_version_idx on public.scene_revision_asset_ref (asset_version_id);

-- ── 9. placements: one owner project, exactly one fixed target ──
create table public.placement (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  name text,
  asset_id uuid,
  asset_version_id uuid,
  scene_revision_id uuid,
  location geometry(Point, 4326),
  altitude double precision,
  anchor_id uuid references public.asset(id) on delete restrict,
  render_config jsonb not null default '{}'::jsonb
    constraint placement_render_config_check check (jsonb_typeof(render_config) = 'object'),
  status text not null default 'draft'
    constraint placement_status_check
    check (status = any (array['draft'::text, 'active'::text, 'paused'::text, 'archived'::text])),
  lock_version integer not null default 1,
  created_by uuid references public.users(user_id) on delete set null,
  updated_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placement_target_xor check (num_nonnulls(asset_version_id, scene_revision_id) = 1),
  constraint placement_asset_pair_check check ((asset_version_id is null) = (asset_id is null)),
  constraint placement_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete restrict,
  constraint placement_asset_version_fk foreign key (asset_version_id, asset_id)
    references public.asset_version(id, asset_id) on delete restrict,
  constraint placement_asset_version_org_fk foreign key (asset_version_id, organization_id)
    references public.asset_version(id, organization_id) on delete restrict,
  constraint placement_scene_revision_fk foreign key (scene_revision_id, organization_id)
    references public.scene_revision(id, organization_id) on delete restrict,
  constraint placement_id_workspace_unique unique (id, workspace_id),
  constraint placement_id_organization_unique unique (id, organization_id)
);
create index placement_workspace_idx on public.placement (workspace_id);
create index placement_asset_version_idx on public.placement (asset_version_id) where asset_version_id is not null;
create index placement_scene_revision_idx on public.placement (scene_revision_id) where scene_revision_id is not null;
create index placement_anchor_idx on public.placement (anchor_id) where anchor_id is not null;
create index placement_location_gix on public.placement using gist ((location::geography)) where location is not null;

create table public.placement_tag (
  placement_id uuid not null,
  tag_id uuid not null,
  workspace_id uuid not null,
  primary key (placement_id, tag_id),
  constraint placement_tag_placement_fk foreign key (placement_id, workspace_id)
    references public.placement(id, workspace_id) on delete cascade,
  constraint placement_tag_tag_fk foreign key (tag_id, workspace_id)
    references public.tag(id, workspace_id) on delete cascade
);

-- ── 10. legacy public ids and multi-project scopes (plan §8.3) ──
create table public.legacy_runtime_binding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  public_id uuid not null,
  placement_id uuid not null,
  legacy_asset_id uuid,
  created_at timestamptz not null default now(),
  constraint legacy_runtime_binding_public_unique unique (organization_id, public_id),
  constraint legacy_runtime_binding_placement_unique unique (placement_id),
  constraint legacy_runtime_binding_key_unique unique (id, organization_id, public_id),
  constraint legacy_runtime_binding_placement_fk foreign key (placement_id, organization_id)
    references public.placement(id, organization_id) on delete cascade
);

create table public.legacy_content_map (
  binding_id uuid not null,
  organization_id uuid not null,
  public_id uuid not null,
  workspace_id uuid not null,
  active boolean not null default true,
  tag_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  primary key (binding_id, workspace_id),
  constraint legacy_content_map_scope_unique unique (workspace_id, public_id),
  constraint legacy_content_map_binding_fk foreign key (binding_id, organization_id, public_id)
    references public.legacy_runtime_binding(id, organization_id, public_id) on delete cascade,
  constraint legacy_content_map_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete cascade
);

-- ── 11. audit and command idempotency ──
create table public.content_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid,
  actor_id uuid,
  action text not null,
  object_type text not null,
  object_id uuid,
  workspace_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index content_audit_log_org_idx on public.content_audit_log (organization_id, created_at desc);
create index content_audit_log_object_idx on public.content_audit_log (object_type, object_id);

create table public.content_command_idempotency (
  actor_id uuid not null,
  command text not null,
  idempotency_key text not null
    constraint content_command_idempotency_key_check check (length(idempotency_key) between 8 and 128),
  organization_id uuid not null,
  request_hash text not null,
  result_type text not null,
  result_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, command, idempotency_key)
);

-- ── 12. integrity triggers ──

-- Versions, files and published revisions are immutable. Only a maintenance
-- command (organization purge) may delete them, inside its own transaction.
create function public.reject_immutable_content_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('content_model.writer', true) = 'purge' then
    return old;
  end if;
  raise exception '% rows are immutable', tg_table_name using errcode = '55000';
end;
$$;

create trigger asset_version_immutable before update or delete on public.asset_version
  for each row execute function public.reject_immutable_content_change();
create trigger asset_version_resource_immutable before update or delete on public.asset_version_resource
  for each row execute function public.reject_immutable_content_change();
create trigger scene_revision_immutable before update or delete on public.scene_revision
  for each row execute function public.reject_immutable_content_change();
create trigger scene_revision_asset_ref_immutable before update or delete on public.scene_revision_asset_ref
  for each row execute function public.reject_immutable_content_change();

-- Stale writers: once an organization is readonly/v2, legacy asset writes are
-- refused unless the transaction identifies itself as a content-model writer
-- (set_config('content_model.writer', 'v2' | 'migration' | 'purge', true)).
-- FK actions on created_by/maintained_by/archived_by are not content writes.
create function public.guard_legacy_asset_write() returns trigger
language plpgsql set search_path = public as $$
declare
  writer text := coalesce(current_setting('content_model.writer', true), '');
  row_value public.asset;
  blocked text;
begin
  if writer in ('v2', 'migration', 'purge') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  row_value := case when tg_op = 'DELETE' then old else new end;
  -- Share-lock every organization the row touches (any state): a concurrent
  -- freeze (UPDATE organization) then waits for this writer to finish, and a
  -- writer arriving after the freeze sees it.
  perform 1
  from public.organization o
  where o.id = row_value.organization_id
     or (tg_op = 'UPDATE' and o.id = old.organization_id)
     or o.id in (
       select w.organization_id from public.workspace w
       where w.id = any (coalesce(row_value.workspace_id, '{}'::uuid[])
                         || case when tg_op = 'UPDATE' then coalesce(old.workspace_id, '{}'::uuid[]) else '{}'::uuid[] end)
     )
  order by o.id
  for share;
  select o.content_model_state into blocked
  from public.organization o
  where o.content_model_state in ('readonly', 'v2')
    and (
      o.id = row_value.organization_id
      or (tg_op = 'UPDATE' and o.id = old.organization_id)
      or o.id in (
        select w.organization_id from public.workspace w
        where w.id = any (coalesce(row_value.workspace_id, '{}'::uuid[])
                          || case when tg_op = 'UPDATE' then coalesce(old.workspace_id, '{}'::uuid[]) else '{}'::uuid[] end)
      )
    )
  limit 1;
  if blocked is not null then
    raise exception 'CONTENT_MODEL_UPGRADE_REQUIRED: organization content model is %', blocked
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_legacy_asset_write
  before insert or delete or update of file_type, file_url, text_content, location, metadata, workspace_id,
    anchor_id, name, tag_ids, is_huge, config, content_hash, organization_id, origin_workspace_id,
    visibility, state, current_version_id, origin
  on public.asset
  for each row execute function public.guard_legacy_asset_write();

-- ── 13. legacy mini-program functions stop serving cut-over / archived scopes ──

create or replace function public.get_nearby_assets(user_lat double precision, user_lng double precision, max_distance_meters double precision, p_workspace_id uuid default null, p_organization_id uuid default null)
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
  join organization o on o.id = w.organization_id
  where
    (p_workspace_id is null or w.id = p_workspace_id)
    and (p_organization_id is null or w.organization_id = p_organization_id)
    and o.content_model_state <> 'v2'
    and o.archived_at is null
    and w.archived_at is null
    and a.location is not null
    and ST_DWithin(
      a.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      max_distance_meters
    )
  order by distance;
end;
$$;

create or replace function public.get_huge_assets(p_workspace_id uuid default null, p_organization_id uuid default null)
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
  join organization o on o.id = w.organization_id
  where
    (
      (p_workspace_id is not null and p_organization_id is not null
        and w.id = p_workspace_id and w.organization_id = p_organization_id)
      or
      (p_workspace_id is null and p_organization_id is not null
        and w.organization_id = p_organization_id)
    )
    and o.content_model_state <> 'v2'
    and o.archived_at is null
    and w.archived_at is null
    and a.is_huge = true
    and a.file_type = 'model'
    and a.location is not null;
end;
$$;

create or replace function public.get_shop_assets(p_workspace_id uuid, p_organization_id uuid)
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
  join organization o on o.id = w.organization_id
  where a.file_type = 'shop'
    and p_workspace_id = any(a.workspace_id)
    and o.content_model_state <> 'v2'
    and o.archived_at is null
    and w.archived_at is null
  order by a.create_at desc;
$$;

-- Anchors keep their asset identity in every state; archived scopes stop matching.
create or replace function public.find_nearby_matching_anchors(p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision)
returns table(id uuid, name text, file_url text, metadata jsonb, distance_meters double precision)
language sql stable set search_path = public as $$
  select a.id, a.name::text, a.file_url::text, a.metadata::jsonb,
    ST_Distance(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography)
  from public.asset a
  where a.file_type='anchor' and a.file_url is not null and a.location is not null
    and a.workspace_id @> array[p_workspace_id]
    and exists (
      select 1 from public.workspace w join public.organization o on o.id = w.organization_id
      where w.id = p_workspace_id and w.archived_at is null and o.archived_at is null
    )
    and ST_DWithin(ST_SetSRID(a.location::geometry,4326)::geography, ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography, least(greatest(p_radius,0),200))
  order by 5, a.id limit 201;
$$;

create or replace function public.upload_text_asset(content text, p_workspace_id uuid, p_organization_id uuid default null, user_lng double precision default null, user_lat double precision default null, p_metadata jsonb default null) returns json
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

  -- 切换后的组织由 placement 服务写入；归档范围不再接受投稿
  if exists (
    select 1 from workspace w join organization o on o.id = w.organization_id
    where w.id = p_workspace_id
      and (o.content_model_state in ('readonly', 'v2') or o.archived_at is not null or w.archived_at is not null)
  ) then
    raise exception 'Workspace not accepting legacy text submissions';
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

-- ── 14. organization purge covers the new tables (plan §5.2, §8.5) ──
-- Rows only; storage objects are handled by the application's retention
-- protocol (lib/storage/retention.server.ts), which re-checks every key.
create or replace function public.purge_organizations(_org_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public set content_model.writer = 'purge' as $$
declare
  _ws_ids uuid[];
  _deleted_assets integer := 0;
  _stripped_assets integer := 0;
  _deleted_workspaces integer := 0;
  _deleted_orgs integer := 0;
  _deleted_versions integer := 0;
  _legacy_deleted integer := 0;
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
  delete from public.asset_workspace_grant where organization_id = any(_org_ids);
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
    -- 完全包含在被删 workspace 集合内的资产：删行
    -- （空数组 <@ 任何集合都为真，须排除，避免误删已无归属的资产）
    delete from public.asset
    where organization_id is null
      and workspace_id is not null
      and workspace_id <> '{}'::uuid[]
      and workspace_id <@ _ws_ids;
    get diagnostics _legacy_deleted = row_count;
    _deleted_assets := _deleted_assets + _legacy_deleted;

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
    'deleted_orgs', _deleted_orgs,
    'deleted_versions', _deleted_versions
  );
end;
$$;
