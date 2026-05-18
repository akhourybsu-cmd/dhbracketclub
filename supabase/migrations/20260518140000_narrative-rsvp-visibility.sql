-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Narrative RPG · Phase 3 invitation RSVP visibility
--
-- Phase 2 introduced invite-only campaigns where a GM adds a member at
-- status='active' immediately. Phase 3 introduces a proper RSVP step:
-- newly-invited members get status='invited' and must accept before
-- they become 'active'.
--
-- The Phase 1 `narrative_can_see_campaign()` helper only counted
-- status='active' members. That means invited users couldn't see the
-- campaign they were invited to. This migration widens the helper so
-- invited members can also see the campaign — but ONLY their own member
-- row + the campaign metadata (RLS on every other table still requires
-- active membership for sensitive reads).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.narrative_has_pending_invite(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.narrative_campaign_members
    where campaign_id = _campaign and user_id = _user and status = 'invited'
  );
$$;

-- Widen narrative_can_see_campaign: an invited (pending RSVP) member of
-- an invite_only campaign can see the campaign row. Everything else
-- about the function stays identical.
create or replace function public.narrative_can_see_campaign(_campaign uuid, _user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  with c as (
    select * from public.narrative_campaigns where id = _campaign
  )
  select case
    when (select count(*) from c) = 0 then false
    when (select club_id from c) <> public.current_user_club_id() and not public.is_app_admin(_user) then false
    when (select created_by from c) = _user then true
    when (select proposed_gm_id from c) = _user then true
    when (select gm_id from c) = _user then true
    when public.narrative_is_club_admin(_campaign, _user) then true
    when (select status from c) in ('draft', 'pending_approval', 'needs_changes', 'rejected') then false
    when (select visibility from c) = 'invite_only' then
      public.narrative_is_member(_campaign, _user)
      or public.narrative_has_pending_invite(_campaign, _user)
    when (select visibility from c) in ('club_visible', 'club_public') then
      exists (select 1 from public.club_members m where m.club_id = (select club_id from c) and m.user_id = _user)
    else false
  end;
$$;
