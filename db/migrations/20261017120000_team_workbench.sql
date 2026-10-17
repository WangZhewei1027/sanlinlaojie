-- Team workbench (docs/team-workbench-backend-contract.md).
--
-- The organization is the only permission boundary. Assets and scenes belong
-- to the organization directly; workspace rows remain only as storage for
-- map collections, which own placements. Forward-only and additive: no
-- content row is rewritten; workspace_assignment and asset_workspace_grant
-- rows stay as history and are no longer read for permissions.
--
-- Apply before deploying code that writes team scenes or organization-only
-- upload receipts (both store workspace_id = null). The previous code keeps
-- working on this schema: it always sets both columns. After this migration a
-- new sign-up's personal team is v2 without a default workspace.
--
-- db/schema.sql carries the same structures and records this file in
-- schema_migrations, so a fresh database never re-applies it.

-- ── 1. scenes are team-owned; workspace_id is legacy origin metadata ──
-- The composite FK stays: a non-null origin must be a collection of the same
-- organization, and a referenced collection cannot be hard-deleted.
alter table public.scene alter column workspace_id drop not null;
-- The composite FK is skipped when workspace_id is null, so team scenes need a
-- direct tenant FK (no action): an organization with scenes cannot be deleted.
alter table public.scene
  add constraint scene_organization_fk foreign key (organization_id)
    references public.organization(id);
create index scene_organization_idx on public.scene (organization_id, updated_at desc);

-- ── 2. upload receipts are organization leases; the collection is optional ──
-- Organization integrity no longer depends on the workspace FK. Deleting a
-- collection keeps in-flight leases (set null) instead of dropping them,
-- so the collector stays away from objects that are still being committed.
alter table public.upload_receipt alter column workspace_id drop not null;
alter table public.upload_receipt drop constraint upload_receipt_workspace_fk;
alter table public.upload_receipt
  add constraint upload_receipt_organization_fk foreign key (organization_id)
    references public.organization(id) on delete cascade,
  add constraint upload_receipt_workspace_fk foreign key (workspace_id, organization_id)
    references public.workspace(id, organization_id) on delete set null (workspace_id);

-- ── 3. team map: placements of every collection by organization ──
create index placement_organization_idx on public.placement (organization_id);

-- ── 4. every member of an organization reaches all of its collections ──
create or replace function public.get_user_workspaces(p_user_id uuid)
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
    -- Team model: organization membership (any role) is the only access path;
    -- workspace_assignment rows are history and grant nothing.
    return query
    select w.id, w.name, w.description, w.create_date, w.organization_id
    from workspace w
    inner join organization_member om on w.organization_id = om.organization_id
    where om.user_id = p_user_id
    order by w.create_date desc;
  end if;
end;
$$;

-- ── 5. new sign-ups get a v2 personal team with zero collections ──
-- Only rows created from now on are affected: existing organizations keep their
-- state, and the organization.content_model_state column default stays 'legacy'.
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

  -- Team workbench: a new personal team starts on the v2 content model with
  -- zero map collections (content needs none; collections are created on demand).
  insert into public.organization (name, created_by, allowed_file_types, content_model_state, content_model_changed_at)
  values (
    coalesce(user_name, split_part(new.email, '@', 1)) || '''s Organization',
    new.id,
    default_types,
    'v2',
    now()
  )
  returning id into new_org_id;

  insert into public.organization_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;
