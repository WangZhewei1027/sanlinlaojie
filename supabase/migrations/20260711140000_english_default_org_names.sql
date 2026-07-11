-- Use English names for the auto-provisioned personal org and default workspace
-- ("X's Organization" / "Default Workspace") instead of Chinese.

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
    coalesce(nullif(user_name, ''), split_part(new.email, '@', 1)) || '''s Organization',
    new.id
  )
  returning id into new_org_id;

  insert into public.organization_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.workspace (name, organization_id)
  values ('Default Workspace', new_org_id);

  return new;
end;
$function$;
