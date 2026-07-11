-- Migration E: 错误日志表 error_log（错误落库，便于后期分析）
-- 由服务端 logError 与客户端 /api/errors 写入，fire-and-forget。

create table if not exists public.error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid,
  scope text,
  method text,
  path text,
  status int,
  message text,
  context jsonb
);

create index if not exists idx_error_log_created_at
  on public.error_log (created_at desc);
create index if not exists idx_error_log_status
  on public.error_log (status);
