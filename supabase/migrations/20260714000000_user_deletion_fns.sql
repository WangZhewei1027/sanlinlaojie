-- 删除用户的两个配套函数（仅经 service-role 调用，供 DELETE /api/users/[id] 使用）：
--
-- 1) promote_owner_successors：用户被删除前，在他是唯一 owner 但还有其他成员的
--    组织里，原子地把最合适的成员晋升为 owner（admin 优先，其次按加入时间最早）。
--
-- 2) purge_organizations：整体删除"只剩被删用户一人"的组织。asset.workspace_id
--    是 uuid[]（资产可跨 workspace/组织）且对 workspace 无外键，所以必须区分
--    "完全包含在被删组织内的资产"（删行）与"跨组织资产"（仅从数组剥离被删的
--    workspace id）。存储桶文件由应用层先按引用计数清理（SQL 删不了 Storage）。

create or replace function public.promote_owner_successors(
  _org_ids uuid[],
  _excluding_user uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

create or replace function public.purge_organizations(_org_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke execute on function public.promote_owner_successors(uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.purge_organizations(uuid[]) from public, anon, authenticated;
