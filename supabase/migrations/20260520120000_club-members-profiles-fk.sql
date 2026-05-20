-- DH Club — Foreign key from club_members.user_id → profiles.id
--
-- Without this constraint, PostgREST cannot resolve the nested-select
-- syntax used by MemberManagementSheet:
--
--   .from('club_members').select('user_id, profiles:user_id(...)')
--
-- The query errors with "Could not find a relationship between
-- 'club_members' and 'profiles' in the schema cache." That bubbled up
-- as "Failed to load club members." in the Narrative RPG manage-members
-- sheet.
--
-- Matches the pattern already used for member_birthdays and
-- club_milestones in migration 20260513040311. profiles.id mirrors
-- auth.users.id, so the underlying users-deletion cascade still works
-- via the existing profiles.id → auth.users.id FK.
--
-- Idempotent: drops first, then adds, so re-running is safe.

alter table public.club_members
  drop constraint if exists club_members_user_id_profiles_fkey;

alter table public.club_members
  add constraint club_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
