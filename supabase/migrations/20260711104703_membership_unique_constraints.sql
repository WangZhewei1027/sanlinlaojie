-- Migration C: 幂等唯一约束
-- organization_member(org, user) 与 workspace_assignment(workspace, user) 各加唯一约束，
-- 使邀请自动加入 / workspace 分配可用 on conflict do nothing 兜幂等与并发。
-- 已实测两表当前无重复行（dup_groups=0），可直接创建。

alter table public.organization_member
  add constraint organization_member_org_user_unique
  unique (organization_id, user_id);

alter table public.workspace_assignment
  add constraint workspace_assignment_ws_user_unique
  unique (workspace_id, user_id);
