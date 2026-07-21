-- 用户级组织置顶偏好（管理台 OrgSwitcher）。
-- 独立成表而非加在 organization_member 上：super_admin 通过
-- get_user_organizations 的 LEFT JOIN 能看到自己不是成员的组织，
-- 这些组织没有 organization_member 行可挂偏好字段。
create table if not exists public.user_organization_pin (
  user_id uuid not null references public.users(user_id) on delete cascade,
  organization_id uuid not null references public.organization(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- 纯用户私有数据，直接上 RLS：只允许操作自己的行。
alter table public.user_organization_pin enable row level security;

create policy "select own pins" on public.user_organization_pin
  for select using (auth.uid() = user_id);

create policy "insert own pins" on public.user_organization_pin
  for insert with check (auth.uid() = user_id);

create policy "delete own pins" on public.user_organization_pin
  for delete using (auth.uid() = user_id);

-- get_user_organizations 返回列新增 pinned_at（改返回类型必须先 drop）。
drop function if exists public.get_user_organizations(uuid);

create function public.get_user_organizations(p_user_id uuid)
returns table(
  id uuid,
  name text,
  description text,
  created_at timestamptz,
  role text,
  map_center jsonb,
  allowed_file_types text[],
  pinned_at timestamptz
)
language plpgsql
as $function$
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
$function$;
