-- Migration D: admin 也能看到本 org 全部 workspace
-- 把「见全部」条件从 om.role = 'owner' 扩到 om.role IN ('owner','admin')。
-- 纯增量：member/viewer 分支（EXISTS workspace_assignment）保持不变。

create or replace function public.get_user_workspaces(p_user_id uuid)
returns table(id uuid, name text, description text, create_date timestamp with time zone, organization_id uuid)
language plpgsql
as $function$
declare
  v_user_role user_role;
begin
  select u.role into v_user_role from users u where u.user_id = p_user_id;

  if not found then
    return;
  end if;

  -- super_admin 见全部 workspace
  if v_user_role = 'super_admin' then
    return query
    select w.id, w.name, w.description, w.create_date, w.organization_id
    from workspace w
    order by w.create_date desc;
  else
    -- org owner/admin 见本 org 全部；member/viewer 仅见被分配的
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
$function$;
