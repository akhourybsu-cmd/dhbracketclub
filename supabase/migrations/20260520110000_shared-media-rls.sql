-- DH Club — Shared Media · Tighten message_link_previews RLS
--
-- The current "MessageLinkPreviews: club write" FOR ALL policy is
-- club-scoped but does NOT check that the deleter is the original
-- message sender or a club admin. Any club member can delete any
-- other member's shared link from the Shared Media page.
--
-- This migration replaces the catch-all ALL policy with three
-- explicit policies:
--   • INSERT: any club member (unchanged behavior — the backend
--             link-preview fetch service inserts on behalf of the
--             original sender via the existing trigger pipeline)
--   • UPDATE: only the original message sender, club admin, or
--             platform owner
--   • DELETE: same — sender, admin, or platform owner
--
-- This matches the message-level delete policy ("Users can delete
-- own messages" gated to user_id = auth.uid()) and respects
-- moderation expectations.

-- Drop the over-permissive ALL policy.
drop policy if exists "MessageLinkPreviews: club write" on public.message_link_previews;
-- Older migration name — drop if it still exists from history.
drop policy if exists "Authenticated can delete link previews" on public.message_link_previews;
drop policy if exists "Users can delete own link previews" on public.message_link_previews;

-- INSERT: any club member can insert into their own club. The actual
-- link-preview generator is server-side, but allowing client inserts
-- keeps the existing "auto-create on message paste" path working.
create policy "MessageLinkPreviews: club insert"
  on public.message_link_previews
  for insert
  to authenticated
  with check (
    club_id = public.current_user_club_id()
    or public.is_platform_owner(auth.uid())
  );

-- UPDATE: original message sender, club admin of the row's club, or
-- platform owner. Used for re-fetching the OG preview, fixing typos
-- in title/description, etc.
create policy "MessageLinkPreviews: sender or admin update"
  on public.message_link_previews
  for update
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.club_members cm
      where cm.user_id = auth.uid()
        and cm.club_id = message_link_previews.club_id
        and cm.role = 'admin'
    )
    or public.is_platform_owner(auth.uid())
  )
  with check (
    club_id = public.current_user_club_id()
    or public.is_platform_owner(auth.uid())
  );

-- DELETE: same authorization profile. Closes the bug where any
-- club member could delete any link preview from Shared Media.
create policy "MessageLinkPreviews: sender or admin delete"
  on public.message_link_previews
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.club_members cm
      where cm.user_id = auth.uid()
        and cm.club_id = message_link_previews.club_id
        and cm.role = 'admin'
    )
    or public.is_platform_owner(auth.uid())
  );

-- SELECT policy ("MessageLinkPreviews: club read") is intentionally
-- preserved — every club member should be able to browse shared
-- media for their club.
