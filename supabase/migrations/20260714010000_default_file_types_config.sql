-- 新组织默认文件类型可配置化：
--
-- 1) app_config 表：全局键值配置，目前仅 default_allowed_file_types。
--    启用 RLS 且不加任何 policy —— 只有 service-role（super-admin 系统设置 API）
--    和 security definer 触发器能读写。
-- 2) handle_new_user：注册自动建的个人组织按该配置写入显式 allowed_file_types。
-- 3) 存量回填：allowed_file_types 为 null 的组织补成当前默认集合
--    （与代码兜底 DEFAULT_UPLOAD_TYPES 相同，效果不变，消除 null 歧义）。

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values (
  'default_allowed_file_types',
  '["image","video","audio","link","text","anchor","shop"]'::jsonb
)
on conflict (key) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  user_name text;
  new_org_id uuid;
  default_types text[];
begin
  user_name := new.raw_user_meta_data->>'name';

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
    coalesce(nullif(user_name, ''), split_part(new.email, '@', 1)) || '''s Organization',
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
$function$;

-- 存量回填（幂等）
update public.organization
set allowed_file_types = (
  select array(select jsonb_array_elements_text(value))
  from public.app_config
  where key = 'default_allowed_file_types'
)
where allowed_file_types is null;
