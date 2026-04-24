
-- =====================================================================
-- PHASE 3: RLS HARDENING FOR MULTI-CLUB ISOLATION
-- Enforces club_id = current_user_club_id() across all club-scoped tables
-- Platform owner (Alex) bypasses all checks for support/moderation.
-- =====================================================================

-- Helper macro pattern: each table gets:
--   - SELECT: club match OR platform owner
--   - INSERT: club match OR platform owner (club_id auto-set by trigger)
--   - UPDATE: club match OR platform owner
--   - DELETE: club admin OR platform owner (or row owner where applicable)

-- ---------- DRAFTS ----------
DROP POLICY IF EXISTS "Drafts: club members read" ON public.drafts;
DROP POLICY IF EXISTS "Drafts: club members insert" ON public.drafts;
DROP POLICY IF EXISTS "Drafts: club members update" ON public.drafts;
DROP POLICY IF EXISTS "Drafts: creators or admins delete" ON public.drafts;

CREATE POLICY "Drafts: club members read" ON public.drafts FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Drafts: club members insert" ON public.drafts FOR INSERT
  WITH CHECK ((club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid())) AND created_by = auth.uid());
CREATE POLICY "Drafts: club members update" ON public.drafts FOR UPDATE
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Drafts: creators or admins delete" ON public.drafts FOR DELETE
  USING ((club_id = public.current_user_club_id() AND (created_by = auth.uid() OR public.is_club_admin(auth.uid(), club_id))) OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_PICKS ----------
DROP POLICY IF EXISTS "DraftPicks: club read" ON public.draft_picks;
DROP POLICY IF EXISTS "DraftPicks: club insert" ON public.draft_picks;
DROP POLICY IF EXISTS "DraftPicks: club update" ON public.draft_picks;
DROP POLICY IF EXISTS "DraftPicks: club delete" ON public.draft_picks;
CREATE POLICY "DraftPicks: club read" ON public.draft_picks FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftPicks: club insert" ON public.draft_picks FOR INSERT
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftPicks: club update" ON public.draft_picks FOR UPDATE
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftPicks: club delete" ON public.draft_picks FOR DELETE
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_PARTICIPANTS ----------
DROP POLICY IF EXISTS "DraftParticipants: club read" ON public.draft_participants;
DROP POLICY IF EXISTS "DraftParticipants: club write" ON public.draft_participants;
CREATE POLICY "DraftParticipants: club read" ON public.draft_participants FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftParticipants: club write" ON public.draft_participants FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_RESULTS ----------
DROP POLICY IF EXISTS "DraftResults: club read" ON public.draft_results;
DROP POLICY IF EXISTS "DraftResults: club write" ON public.draft_results;
CREATE POLICY "DraftResults: club read" ON public.draft_results FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftResults: club write" ON public.draft_results FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_SEASONS ----------
DROP POLICY IF EXISTS "DraftSeasons: club read" ON public.draft_seasons;
DROP POLICY IF EXISTS "DraftSeasons: club write" ON public.draft_seasons;
CREATE POLICY "DraftSeasons: club read" ON public.draft_seasons FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftSeasons: club write" ON public.draft_seasons FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_SEASON_ENTRIES ----------
DROP POLICY IF EXISTS "DraftSeasonEntries: club read" ON public.draft_season_entries;
DROP POLICY IF EXISTS "DraftSeasonEntries: club write" ON public.draft_season_entries;
CREATE POLICY "DraftSeasonEntries: club read" ON public.draft_season_entries FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftSeasonEntries: club write" ON public.draft_season_entries FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_SEASON_STANDINGS ----------
DROP POLICY IF EXISTS "DraftSeasonStandings: club read" ON public.draft_season_standings;
DROP POLICY IF EXISTS "DraftSeasonStandings: club write" ON public.draft_season_standings;
CREATE POLICY "DraftSeasonStandings: club read" ON public.draft_season_standings FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftSeasonStandings: club write" ON public.draft_season_standings FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_PLAYOFF_MATCHES ----------
DROP POLICY IF EXISTS "DraftPlayoffMatches: club read" ON public.draft_playoff_matches;
DROP POLICY IF EXISTS "DraftPlayoffMatches: club write" ON public.draft_playoff_matches;
CREATE POLICY "DraftPlayoffMatches: club read" ON public.draft_playoff_matches FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftPlayoffMatches: club write" ON public.draft_playoff_matches FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- DRAFT_PICK_DISPUTES ----------
DROP POLICY IF EXISTS "DraftPickDisputes: club read" ON public.draft_pick_disputes;
DROP POLICY IF EXISTS "DraftPickDisputes: club write" ON public.draft_pick_disputes;
CREATE POLICY "DraftPickDisputes: club read" ON public.draft_pick_disputes FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "DraftPickDisputes: club write" ON public.draft_pick_disputes FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- CHANNELS ----------
DROP POLICY IF EXISTS "Channels: club read" ON public.channels;
DROP POLICY IF EXISTS "Channels: club write" ON public.channels;
CREATE POLICY "Channels: club read" ON public.channels FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Channels: club write" ON public.channels FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- CHANNEL_CATEGORIES ----------
DROP POLICY IF EXISTS "ChannelCategories: club read" ON public.channel_categories;
DROP POLICY IF EXISTS "ChannelCategories: club write" ON public.channel_categories;
CREATE POLICY "ChannelCategories: club read" ON public.channel_categories FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "ChannelCategories: club write" ON public.channel_categories FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- CHANNEL_READ_STATES ----------
DROP POLICY IF EXISTS "ChannelReadStates: own read" ON public.channel_read_states;
DROP POLICY IF EXISTS "ChannelReadStates: own write" ON public.channel_read_states;
CREATE POLICY "ChannelReadStates: own read" ON public.channel_read_states FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "ChannelReadStates: own write" ON public.channel_read_states FOR ALL
  USING (user_id = auth.uid() AND (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid())))
  WITH CHECK (user_id = auth.uid() AND (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid())));

-- ---------- EVENTS ----------
DROP POLICY IF EXISTS "Events: club read" ON public.events;
DROP POLICY IF EXISTS "Events: club write" ON public.events;
CREATE POLICY "Events: club read" ON public.events FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Events: club write" ON public.events FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- EVENT_RSVPS ----------
DROP POLICY IF EXISTS "EventRsvps: club read" ON public.event_rsvps;
DROP POLICY IF EXISTS "EventRsvps: club write" ON public.event_rsvps;
CREATE POLICY "EventRsvps: club read" ON public.event_rsvps FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "EventRsvps: club write" ON public.event_rsvps FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- EVENT_COMMENTS ----------
DROP POLICY IF EXISTS "EventComments: club read" ON public.event_comments;
DROP POLICY IF EXISTS "EventComments: club write" ON public.event_comments;
CREATE POLICY "EventComments: club read" ON public.event_comments FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "EventComments: club write" ON public.event_comments FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LOCKBOX_WEEKS ----------
DROP POLICY IF EXISTS "LockboxWeeks: club read" ON public.lockbox_weeks;
DROP POLICY IF EXISTS "LockboxWeeks: club write" ON public.lockbox_weeks;
CREATE POLICY "LockboxWeeks: club read" ON public.lockbox_weeks FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LockboxWeeks: club write" ON public.lockbox_weeks FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LOCKBOX_LOCKS ----------
DROP POLICY IF EXISTS "LockboxLocks: club read" ON public.lockbox_locks;
DROP POLICY IF EXISTS "LockboxLocks: club write" ON public.lockbox_locks;
CREATE POLICY "LockboxLocks: club read" ON public.lockbox_locks FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LockboxLocks: club write" ON public.lockbox_locks FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LOCKBOX_ATTEMPTS ----------
DROP POLICY IF EXISTS "LockboxAttempts: club read" ON public.lockbox_attempts;
DROP POLICY IF EXISTS "LockboxAttempts: club write" ON public.lockbox_attempts;
CREATE POLICY "LockboxAttempts: club read" ON public.lockbox_attempts FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LockboxAttempts: club write" ON public.lockbox_attempts FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LOCKBOX_GUESSES ----------
DROP POLICY IF EXISTS "LockboxGuesses: club read" ON public.lockbox_guesses;
DROP POLICY IF EXISTS "LockboxGuesses: club write" ON public.lockbox_guesses;
CREATE POLICY "LockboxGuesses: club read" ON public.lockbox_guesses FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LockboxGuesses: club write" ON public.lockbox_guesses FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LOCKBOX_SCORES ----------
DROP POLICY IF EXISTS "LockboxScores: club read" ON public.lockbox_scores;
DROP POLICY IF EXISTS "LockboxScores: club write" ON public.lockbox_scores;
CREATE POLICY "LockboxScores: club read" ON public.lockbox_scores FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LockboxScores: club write" ON public.lockbox_scores FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LORE_ENTRIES ----------
DROP POLICY IF EXISTS "LoreEntries: club read" ON public.lore_entries;
DROP POLICY IF EXISTS "LoreEntries: club write" ON public.lore_entries;
CREATE POLICY "LoreEntries: club read" ON public.lore_entries FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LoreEntries: club write" ON public.lore_entries FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- LORE_CONTRIBUTIONS ----------
DROP POLICY IF EXISTS "LoreContributions: club read" ON public.lore_contributions;
DROP POLICY IF EXISTS "LoreContributions: club write" ON public.lore_contributions;
CREATE POLICY "LoreContributions: club read" ON public.lore_contributions FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "LoreContributions: club write" ON public.lore_contributions FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- ACTIVITY_FEED ----------
DROP POLICY IF EXISTS "ActivityFeed: club read" ON public.activity_feed;
DROP POLICY IF EXISTS "ActivityFeed: club write" ON public.activity_feed;
CREATE POLICY "ActivityFeed: club read" ON public.activity_feed FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "ActivityFeed: club write" ON public.activity_feed FOR INSERT
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- INVITE_CODES ----------
DROP POLICY IF EXISTS "InviteCodes: club admin manage" ON public.invite_codes;
DROP POLICY IF EXISTS "InviteCodes: lookup by code" ON public.invite_codes;
-- Anyone can look up an invite code during signup (no auth yet)
CREATE POLICY "InviteCodes: lookup by code" ON public.invite_codes FOR SELECT
  USING (true);
-- Only club admins or platform owner can mutate
CREATE POLICY "InviteCodes: club admin manage" ON public.invite_codes FOR ALL
  USING ((club_id = public.current_user_club_id() AND public.is_club_admin(auth.uid(), club_id)) OR public.is_platform_owner(auth.uid()))
  WITH CHECK ((club_id = public.current_user_club_id() AND public.is_club_admin(auth.uid(), club_id)) OR public.is_platform_owner(auth.uid()));

-- ---------- BRACKETS ----------
DROP POLICY IF EXISTS "Brackets: club read" ON public.brackets;
DROP POLICY IF EXISTS "Brackets: club write" ON public.brackets;
CREATE POLICY "Brackets: club read" ON public.brackets FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Brackets: club write" ON public.brackets FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- BRACKET_PICKS ----------
DROP POLICY IF EXISTS "BracketPicks: club read" ON public.bracket_picks;
DROP POLICY IF EXISTS "BracketPicks: club write" ON public.bracket_picks;
CREATE POLICY "BracketPicks: club read" ON public.bracket_picks FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "BracketPicks: club write" ON public.bracket_picks FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

-- ---------- COMPETITIONS ----------
DROP POLICY IF EXISTS "Competitions: club read" ON public.competitions;
DROP POLICY IF EXISTS "Competitions: club write" ON public.competitions;
CREATE POLICY "Competitions: club read" ON public.competitions FOR SELECT
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
CREATE POLICY "Competitions: club write" ON public.competitions FOR ALL
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()))
  WITH CHECK (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));
