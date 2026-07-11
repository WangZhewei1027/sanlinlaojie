-- Migration B: 邀请表 organization_invitation（可复用链接，自动同意）
-- workspace_id 可选：接受后一并分配到该 workspace；归属一致性在创建/接受时双校验。

create table if not exists public.organization_invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization(id) on delete cascade,
  workspace_id uuid references public.workspace(id) on delete cascade,
  token text not null unique,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_by uuid,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked boolean not null default false,
  use_count int not null default 0
);

create index if not exists idx_org_invitation_token
  on public.organization_invitation (token);
create index if not exists idx_org_invitation_org
  on public.organization_invitation (organization_id);
