-- 存量清理（幂等）：历史上通过 Dashboard 直接删 auth 用户留下的孤儿组织。
--
-- 1) 有成员但没有 owner 的组织：按与 promote_owner_successors 相同的规则
--    （admin 优先，其次加入最早）晋升一名成员为 owner。
-- 2) 零成员组织：调 purge_organizations 整体删除（workspace、资产、成员、邀请）。
--
-- 注意：SQL 无法删除 Storage 桶里的文件。被清理资产若有 file_url，其文件会残留，
-- 可事后用 /api/admin/clean 的 clean-files 按旧 workspace id 清扫（清扫前先确认
-- 该文件未被其他 workspace 的资产以内容 hash 去重方式共享）。
-- 本迁移编写时已核实：现网唯一的零成员组织中仅 1 个资产且 file_url 为 null，无文件残留。

-- 1) 晋升
with ranked as (
  select om.id,
         row_number() over (
           partition by om.organization_id
           order by (om.role = 'admin') desc, om.created_at asc, om.id asc
         ) as rn
  from public.organization_member om
  where om.role <> 'owner'
    and not exists (
      select 1 from public.organization_member o2
      where o2.organization_id = om.organization_id
        and o2.role = 'owner'
    )
)
update public.organization_member m
set role = 'owner'
from ranked r
where m.id = r.id and r.rn = 1;

-- 2) 清除零成员组织
do $$
declare
  _orphans uuid[];
begin
  select coalesce(array_agg(o.id), '{}'::uuid[])
  into _orphans
  from public.organization o
  where not exists (
    select 1 from public.organization_member m
    where m.organization_id = o.id
  );

  if array_length(_orphans, 1) is not null then
    perform public.purge_organizations(_orphans);
  end if;
end;
$$;
