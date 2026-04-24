
-- ============================================================
-- DROP LEGACY PERMISSIVE POLICIES (qual = true) ON CLUB CONTENT
-- ============================================================

-- activity_feed
DROP POLICY IF EXISTS "Activity viewable by authenticated" ON public.activity_feed;

-- channel_categories
DROP POLICY IF EXISTS "Categories viewable by authenticated" ON public.channel_categories;
DROP POLICY IF EXISTS "Authenticated can create categories" ON public.channel_categories;
DROP POLICY IF EXISTS "Authenticated can update categories" ON public.channel_categories;
DROP POLICY IF EXISTS "Authenticated can delete categories" ON public.channel_categories;

-- channels
DROP POLICY IF EXISTS "Channels viewable by authenticated" ON public.channels;
DROP POLICY IF EXISTS "Authenticated can update channels" ON public.channels;

-- competitions
DROP POLICY IF EXISTS "Competitions viewable by authenticated" ON public.competitions;

-- draft_participants
DROP POLICY IF EXISTS "Draft participants viewable by authenticated" ON public.draft_participants;

-- draft_pick_disputes
DROP POLICY IF EXISTS "Disputes viewable by authenticated" ON public.draft_pick_disputes;

-- draft_picks
DROP POLICY IF EXISTS "Draft picks viewable by authenticated" ON public.draft_picks;

-- draft_playoff_matches
DROP POLICY IF EXISTS "Matches viewable by authenticated" ON public.draft_playoff_matches;
DROP POLICY IF EXISTS "Authenticated can create matches" ON public.draft_playoff_matches;
DROP POLICY IF EXISTS "Authenticated can update matches" ON public.draft_playoff_matches;

-- draft_results
DROP POLICY IF EXISTS "Draft results viewable by authenticated" ON public.draft_results;

-- draft_season_entries
DROP POLICY IF EXISTS "Entries viewable by authenticated" ON public.draft_season_entries;
DROP POLICY IF EXISTS "Authenticated can create entries" ON public.draft_season_entries;
DROP POLICY IF EXISTS "Authenticated can update entries" ON public.draft_season_entries;
DROP POLICY IF EXISTS "Authenticated can delete entries" ON public.draft_season_entries;

-- draft_season_standings
DROP POLICY IF EXISTS "Standings viewable by authenticated" ON public.draft_season_standings;
DROP POLICY IF EXISTS "Authenticated can insert standings" ON public.draft_season_standings;
DROP POLICY IF EXISTS "Authenticated can update standings" ON public.draft_season_standings;
DROP POLICY IF EXISTS "Authenticated can delete standings" ON public.draft_season_standings;

-- draft_seasons
DROP POLICY IF EXISTS "Seasons viewable by authenticated" ON public.draft_seasons;
DROP POLICY IF EXISTS "Authenticated can create seasons" ON public.draft_seasons;

-- drafts
DROP POLICY IF EXISTS "Drafts viewable by authenticated" ON public.drafts;
DROP POLICY IF EXISTS "Users can create drafts" ON public.drafts; -- legacy: bypasses club scope on insert

-- event_comments
DROP POLICY IF EXISTS "Event comments viewable by authenticated" ON public.event_comments;

-- event_rsvps
DROP POLICY IF EXISTS "RSVPs viewable by authenticated" ON public.event_rsvps;

-- events
DROP POLICY IF EXISTS "Events viewable by authenticated" ON public.events;

-- lockbox_*
DROP POLICY IF EXISTS "Attempts viewable by authenticated" ON public.lockbox_attempts;
DROP POLICY IF EXISTS "Guesses viewable by authenticated" ON public.lockbox_guesses;
DROP POLICY IF EXISTS "Locks viewable by authenticated" ON public.lockbox_locks;
DROP POLICY IF EXISTS "Scores viewable by authenticated" ON public.lockbox_scores;
DROP POLICY IF EXISTS "Authenticated can delete scores" ON public.lockbox_scores;
DROP POLICY IF EXISTS "Weeks viewable by authenticated" ON public.lockbox_weeks;
DROP POLICY IF EXISTS "Authenticated can insert weeks" ON public.lockbox_weeks;
DROP POLICY IF EXISTS "Authenticated can update weeks" ON public.lockbox_weeks;

-- lore_*
DROP POLICY IF EXISTS "Lore entries viewable by authenticated" ON public.lore_entries;
DROP POLICY IF EXISTS "Lore contributions viewable by authenticated" ON public.lore_contributions;
DROP POLICY IF EXISTS "Lore reactions viewable by authenticated" ON public.lore_reactions;

-- messages & related
DROP POLICY IF EXISTS "Messages viewable by authenticated" ON public.messages;
DROP POLICY IF EXISTS "Reactions viewable by authenticated" ON public.message_reactions;
DROP POLICY IF EXISTS "Link previews viewable by authenticated" ON public.message_link_previews;
DROP POLICY IF EXISTS "Authenticated can delete link previews" ON public.message_link_previews;

-- polls
DROP POLICY IF EXISTS "Polls viewable by authenticated" ON public.polls;
DROP POLICY IF EXISTS "Poll options viewable by authenticated" ON public.poll_options;
DROP POLICY IF EXISTS "Votes viewable by authenticated" ON public.poll_votes;

-- posts
DROP POLICY IF EXISTS "Posts viewable by authenticated" ON public.posts;
DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.post_comments;

-- rankings
DROP POLICY IF EXISTS "Rankings viewable by authenticated" ON public.rankings;
DROP POLICY IF EXISTS "Ranking items viewable by authenticated" ON public.ranking_items;
DROP POLICY IF EXISTS "Submissions viewable by authenticated" ON public.ranking_submissions;
DROP POLICY IF EXISTS "Entries viewable by authenticated" ON public.ranking_submission_entries;

-- generic reactions
DROP POLICY IF EXISTS "Reactions viewable by authenticated" ON public.reactions;

-- ============================================================
-- ADD STRICT CLUB-SCOPED POLICIES WHERE ONLY LEGACY EXISTED
-- (All these tables already have a club_id column.)
-- ============================================================

-- polls
CREATE POLICY "Polls: club read" ON public.polls FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "Polls: club write" ON public.polls FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "PollOptions: club read" ON public.poll_options FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "PollOptions: club write" ON public.poll_options FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "PollVotes: club read" ON public.poll_votes FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "PollVotes: club write" ON public.poll_votes FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- rankings
CREATE POLICY "Rankings: club read" ON public.rankings FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "Rankings: club write" ON public.rankings FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "RankingItems: club read" ON public.ranking_items FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RankingItems: club write" ON public.ranking_items FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "RankingSubs: club read" ON public.ranking_submissions FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RankingSubs: club write" ON public.ranking_submissions FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "RankingSubEntries: club read" ON public.ranking_submission_entries FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RankingSubEntries: club write" ON public.ranking_submission_entries FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- posts
CREATE POLICY "Posts: club read" ON public.posts FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "Posts: club write" ON public.posts FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "PostComments: club read" ON public.post_comments FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "PostComments: club write" ON public.post_comments FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- messages
CREATE POLICY "Messages: club read" ON public.messages FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "Messages: club write" ON public.messages FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "MessageReactions: club read" ON public.message_reactions FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "MessageReactions: club write" ON public.message_reactions FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

CREATE POLICY "MessageLinkPreviews: club read" ON public.message_link_previews FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "MessageLinkPreviews: club write" ON public.message_link_previews FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- lore_reactions
CREATE POLICY "LoreReactions: club read" ON public.lore_reactions FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "LoreReactions: club write" ON public.lore_reactions FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- generic reactions table
CREATE POLICY "Reactions: club read" ON public.reactions FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "Reactions: club write" ON public.reactions FOR ALL
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()))
WITH CHECK ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- ============================================================
-- HARDEN INSERTS THAT BYPASSED CLUB SCOPE
-- ============================================================
-- The auto-trigger set_club_id_from_user() fills club_id on insert,
-- but the WITH CHECK above will then enforce that it matches the user's club.

-- Recreate the safer insert policies for drafts/competitions etc. that
-- already had "club write" ALL policies — those policies cover INSERT correctly
-- because club_id is auto-stamped by the BEFORE INSERT trigger.

-- Channels: keep INSERT permissive on created_by, but stamp club_id via trigger.
-- Already covered by "Channels: club write" ALL policy + set_club_id trigger.
