begin;

-- Private, uncached GPS-first rows. One snapshot binds the candidate set to exact
-- locations and reference generations, so replacing/rebuilding a reference while
-- inference is in flight cannot release assets from stale descriptors.
create or replace function public.read_anchor_match_context(
  p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision
) returns table (
  id uuid, name text, file_url text, distance_meters double precision,
  reference_image_url text, reference_status text, embedding_version text,
  embedding real[], reference_snapshot jsonb
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.name, c.file_url, c.distance_meters,
    e.image_url, e.status, e.embedding_version, e.embedding,
    jsonb_build_object(
      'id', c.id, 'file_url', c.file_url,
      'location', encode(ST_AsEWKB(a.location::geometry), 'hex'),
      'reference_generation', e.generation, 'reference_status', e.status,
      'reference_image_url', e.image_url, 'embedding_version', e.embedding_version,
      'reference_updated_at', e.updated_at, 'reference_sha256', e.image_sha256
    )
  from public.find_nearby_matching_anchors(p_workspace_id, p_lat, p_lng, p_radius) c
  join public.asset a on a.id = c.id
  left join public.anchor_embedding e on e.anchor_id = c.id;
$$;
revoke all on function public.read_anchor_match_context(uuid,double precision,double precision,double precision)
  from public, anon, authenticated;
grant execute on function public.read_anchor_match_context(uuid,double precision,double precision,double precision)
  to service_role;

-- Uses the existing 120-per-minute workspace budget once; no per-reference RPC.
-- The existing nearby function caps at 201 rows, letting the caller reject >200.
create or replace function public.prepare_anchor_match_context(
  p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision
) returns jsonb
language plpgsql security invoker set search_path = public, extensions as $$
declare result jsonb;
begin
  if not public.consume_anchor_match_request(p_workspace_id) then
    return jsonb_build_object('allowed', false, 'candidates', '[]'::jsonb, 'reference_snapshot', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'allowed', true,
    'candidates', coalesce(jsonb_agg(to_jsonb(c) - 'reference_snapshot' order by c.id), '[]'::jsonb),
    'reference_snapshot', coalesce(jsonb_agg(c.reference_snapshot order by c.id), '[]'::jsonb)
  ) into result
  from public.read_anchor_match_context(p_workspace_id, p_lat, p_lng, p_radius) c;
  return result;
end;
$$;
revoke all on function public.prepare_anchor_match_context(uuid,double precision,double precision,double precision)
  from public, anon, authenticated;
grant execute on function public.prepare_anchor_match_context(uuid,double precision,double precision,double precision)
  to service_role;

-- STABLE + one SQL statement keeps candidate/reference recheck and child reading
-- on the same database snapshot. No vector data or snapshot is returned publicly.
create or replace function public.finalize_anchor_match(
  p_workspace_id uuid, p_lat double precision, p_lng double precision, p_radius double precision,
  p_anchor_id uuid, p_reference_snapshot jsonb
) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  with current_candidates as materialized (
    select c.id, c.reference_snapshot
    from public.read_anchor_match_context(p_workspace_id, p_lat, p_lng, p_radius) c
  ), checked as (
    select coalesce(
      count(*) between 1 and 200
      and bool_or(id = p_anchor_id)
      and jsonb_agg(reference_snapshot order by id) = p_reference_snapshot,
      false
    ) as unchanged
    from current_candidates
  )
  select jsonb_build_object(
    'unchanged', checked.unchanged,
    'assets', case when checked.unchanged then (
      select coalesce(jsonb_agg(to_jsonb(child) order by child.id), '[]'::jsonb)
      from (
        select a.id, a.name, a.file_type, a.file_url, a.text_content, a.anchor_id,
          a.tag_ids, a.metadata, a.is_huge, a.config
        from public.asset a
        where a.anchor_id = p_anchor_id and a.file_type <> 'anchor'
          and a.workspace_id @> array[p_workspace_id]
      ) child
    ) else '[]'::jsonb end
  ) from checked;
$$;
revoke all on function public.finalize_anchor_match(uuid,double precision,double precision,double precision,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_anchor_match(uuid,double precision,double precision,double precision,uuid,jsonb)
  to service_role;

commit;
