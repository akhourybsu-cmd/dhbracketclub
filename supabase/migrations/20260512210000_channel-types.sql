-- ═══════════════════════════════════════════════════════════════════
-- DH Club — Channel types & post permissions
--
-- Adds two columns to public.channels:
--   • channel_type     — 'general' | 'announcements' | 'admin_only' | 'event'
--   • post_permission  — 'all' | 'admins'
--
-- All existing rows backfill to ('general', 'all'), preserving current
-- behavior. RLS on messages already scopes by club via
-- current_user_club_id(); this migration adds a server-side guard so
-- non-admins can't post into `admins`-only channels even if they bypass
-- the client gate.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columns ──────────────────────────────────────────────────────

alter table public.channels
  add column if not exists channel_type    text not null default 'general',
  add column if not exists post_permission text not null default 'all';

-- Drop old constraints if re-running, then re-add.
alter table public.channels
  drop constraint if exists channels_channel_type_chk,
  drop constraint if exists channels_post_permission_chk;

alter table public.channels
  add constraint channels_channel_type_chk
    check (channel_type in ('general', 'announcements', 'admin_only', 'event')),
  add constraint channels_post_permission_chk
    check (post_permission in ('all', 'admins'));

create index if not exists channels_club_type_idx
  on public.channels (club_id, channel_type);

-- ── 2. Server-side post-permission guard ────────────────────────────
-- Add an INSERT policy on messages that, on top of the existing
-- "Messages: club write" ALL policy, requires the user to be a club
-- admin if the target channel's post_permission = 'admins'. We keep
-- the existing ALL policy intact (it still requires club scope) and
-- add a restrictive INSERT layer.

drop policy if exists "Messages: post-permission" on public.messages;

create policy "Messages: post-permission"
  on public.messages
  as restrictive
  for insert
  to authenticated
  with check (
    not exists (
      select 1
      from public.channels ch
      where ch.id = messages.channel_id
        and ch.post_permission = 'admins'
    )
    or public.is_app_admin(auth.uid())
    or exists (
      select 1
      from public.club_members cm
      join public.channels ch on ch.id = messages.channel_id
      where cm.club_id = ch.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );
