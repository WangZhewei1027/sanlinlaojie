begin;

-- Support one-second client sampling with overlapping requests. The budget
-- remains shared per workspace across all API replicas and all clients.
-- To roll back, apply a NEW migration with this function body and change only
-- `return used <= 120` to `return used <= 30`; retain the grants below.
create or replace function public.consume_anchor_match_request(p_workspace_id uuid) returns boolean
language plpgsql security invoker set search_path=public as $$
declare used integer;
begin
  insert into public.anchor_match_rate_limit as r values(p_workspace_id,clock_timestamp(),1)
  on conflict(workspace_id) do update set
    request_count=case when r.window_start < clock_timestamp()-interval '1 minute' then 1 else r.request_count+1 end,
    window_start=case when r.window_start < clock_timestamp()-interval '1 minute' then clock_timestamp() else r.window_start end
  returning request_count into used;
  return used <= 120;
end;
$$;
revoke all on function public.consume_anchor_match_request(uuid) from public, anon, authenticated;
grant execute on function public.consume_anchor_match_request(uuid) to service_role;

commit;
