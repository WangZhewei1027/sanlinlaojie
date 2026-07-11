-- Migration A: 注册自动建组织 + owner 成员 + 默认 workspace
-- 重写 handle_new_user()，在插入 users 行后自动为新用户创建个人 org、
-- 将其设为 owner，并建一个默认 workspace。四步原子（任一失败回滚注册）。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  user_name text;
  new_org_id uuid;
begin
  user_name := new.raw_user_meta_data->>'name';

  insert into public.users (user_id, name, role, email)
  values (new.id, user_name, 'user', new.email);

  insert into public.organization (name, created_by)
  values (
    coalesce(nullif(user_name, ''), split_part(new.email, '@', 1)) || '的组织',
    new.id
  )
  returning id into new_org_id;

  insert into public.organization_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.workspace (name, organization_id)
  values ('默认工作区', new_org_id);

  return new;
end;
$function$;
