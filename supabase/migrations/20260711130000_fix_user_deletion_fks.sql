-- Fix: deleting an auth user 500s ("null value in column created_by of
-- relation asset violates not-null constraint").
--
-- Root causes (contradictory / blocking FK on-delete rules vs column nullability):
--
-- 1) asset.created_by is NOT NULL, but its FK to public.users is ON DELETE
--    SET NULL. Deleting a user who created assets makes the cascade try to
--    null asset.created_by → NOT NULL violation → whole delete fails.
--    Fix: allow NULL so the SET NULL cascade can succeed (asset survives,
--    just loses creator attribution — same behavior intended by the FK).
alter table public.asset alter column created_by drop not null;

-- 2) organization.created_by FK was NO ACTION, so deleting any user who
--    created an organization is blocked. With auto-org (handle_new_user),
--    every newly registered user creates their personal org, so this would
--    block deletion of essentially all future users.
--    Fix: ON DELETE SET NULL (keep the org, drop creator attribution).
alter table public.organization
  drop constraint organization_created_by_fkey;

alter table public.organization
  add constraint organization_created_by_fkey
    foreign key (created_by) references public.users (user_id)
    on delete set null;
