-- 批量移动素材：一条 SQL 更新多行的 location 与 metadata（经纬高），
-- 供拖动松手后一次性落库，避免每个素材单发一次 PATCH。
-- metadata 用 jsonb 合并，保留其它键（gps_source/dimensions 等）。
-- location 用 SRID 0，与现有 'POINT(x y)'::geometry 插入路径一致。
create or replace function public.move_assets(_moves jsonb)
returns void
language plpgsql
security invoker
as $$
begin
  update public.asset a
  set
    metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_build_object(
      'longitude', (m->>'longitude')::float8,
      'latitude', (m->>'latitude')::float8,
      'height', (m->>'height')::float8
    ),
    location = ST_MakePoint(
      (m->>'longitude')::float8,
      (m->>'latitude')::float8
    )
  from jsonb_array_elements(_moves) as m
  where a.id = (m->>'assetId')::uuid;
end;
$$;
