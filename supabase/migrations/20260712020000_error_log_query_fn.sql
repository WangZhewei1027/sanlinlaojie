-- error_log_query: unified filter + pagination + aggregation for the
-- super-admin Error Log analysis page. Centralizes the WHERE predicate in one
-- place so the paginated rows, the total count, and the analytics summary all
-- share exactly the same filter semantics.
--
-- Returns: { total, rows, stats } where stats = { byScope, byStatusClass,
-- topPaths, daily }. Called from the server via the service-role client after
-- the caller has been verified as super_admin, so it does not gate on auth.

create or replace function public.error_log_query(
  p_scope text default null,          -- 'client' | 'api' | null (all)
  p_status_class text default null,   -- 'zero' | '4xx' | '5xx' | null (all)
  p_q text default null,              -- substring match on message/path
  p_from timestamptz default null,    -- inclusive lower bound on created_at
  p_to timestamptz default null,      -- exclusive upper bound on created_at
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language sql
stable
as $$
  with f as (
    select *
    from public.error_log e
    where (p_scope is null or e.scope = p_scope)
      and (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at < p_to)
      and (
        p_q is null
        or e.message ilike '%' || p_q || '%'
        or e.path ilike '%' || p_q || '%'
      )
      and (
        p_status_class is null
        or (p_status_class = 'zero' and e.status = 0)
        or (p_status_class = '4xx' and e.status between 400 and 499)
        or (p_status_class = '5xx' and e.status between 500 and 599)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select id, created_at, user_id, scope, method, path, status,
               message, context
        from f
        order by created_at desc
        limit greatest(p_limit, 0)
        offset greatest(p_offset, 0)
      ) t
    ),
    'stats', jsonb_build_object(
      'byScope', (
        select coalesce(jsonb_object_agg(scope, c), '{}'::jsonb)
        from (
          select coalesce(scope, 'unknown') as scope, count(*) as c
          from f group by 1
        ) s
      ),
      'byStatusClass', jsonb_build_object(
        'zero', (select count(*) from f where status = 0),
        '4xx', (select count(*) from f where status between 400 and 499),
        '5xx', (select count(*) from f where status between 500 and 599),
        'other', (
          select count(*) from f
          where status is null
             or (status <> 0 and not (status between 400 and 599))
        )
      ),
      'topPaths', (
        select coalesce(
          jsonb_agg(jsonb_build_object('path', path, 'count', c) order by c desc),
          '[]'::jsonb
        )
        from (
          select coalesce(path, '—') as path, count(*) as c
          from f group by 1 order by c desc limit 8
        ) p
      ),
      'daily', (
        select coalesce(
          jsonb_agg(jsonb_build_object('day', day, 'count', c) order by day),
          '[]'::jsonb
        )
        from (
          select date_trunc('day', created_at)::date as day, count(*) as c
          from f group by 1 order by 1
        ) d
      )
    )
  );
$$;
