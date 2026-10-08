-- The workspace-wide recognition cap becomes a parameter so the application
-- decides it (lib/anchor/recognize.server.ts passes 600/min; per-device limits
-- are enforced in the app). The default keeps the previous 120/min for callers
-- that pass only the workspace — the old app version during the rollout and
-- prepare_anchor_match_context. Idempotent: db/schema.sql already defines the
-- new signature on a fresh database.
drop function if exists public.consume_anchor_match_request(uuid);

create or replace function public.consume_anchor_match_request(p_workspace_id uuid, p_limit integer default 120) returns boolean
language plpgsql set search_path = public as $$
declare used integer;
begin
  insert into public.anchor_match_rate_limit as r values(p_workspace_id,clock_timestamp(),1)
  on conflict(workspace_id) do update set
    request_count=case when r.window_start < clock_timestamp()-interval '1 minute' then 1 else r.request_count+1 end,
    window_start=case when r.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else r.window_start end
  returning request_count into used;
  return used <= p_limit;
end;
$$;
