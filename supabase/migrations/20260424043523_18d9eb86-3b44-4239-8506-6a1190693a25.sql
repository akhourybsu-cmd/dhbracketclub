
-- Drop legacy permissive SELECTs
DROP POLICY IF EXISTS "Picks viewable by authenticated" ON public.nfl_picks;
DROP POLICY IF EXISTS "Tiebreakers viewable by authenticated" ON public.nfl_tiebreakers;
DROP POLICY IF EXISTS "Weekly standings viewable by authenticated" ON public.nfl_weekly_standings;
DROP POLICY IF EXISTS "Season standings viewable by authenticated" ON public.nfl_season_standings;

DROP POLICY IF EXISTS "Heroes viewable by authenticated" ON public.rune_delve_heroes;
DROP POLICY IF EXISTS "Runs viewable by authenticated" ON public.rune_delve_runs;
DROP POLICY IF EXISTS "Progress viewable by authenticated" ON public.rune_delve_progress;
DROP POLICY IF EXISTS "Class progress viewable by authenticated" ON public.rune_delve_class_progress;
DROP POLICY IF EXISTS "Daily runs are readable by authenticated users" ON public.rune_delve_daily_runs;

-- NFL pick'em club-scoped policies
CREATE POLICY "NflPicks: club read" ON public.nfl_picks FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "NflTiebreakers: club read" ON public.nfl_tiebreakers FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "NflWeeklyStandings: club read" ON public.nfl_weekly_standings FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "NflSeasonStandings: club read" ON public.nfl_season_standings FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- RuneDelve club-scoped reads (player-progression tables)
CREATE POLICY "RDHeroes: club read" ON public.rune_delve_heroes FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RDRuns: club read" ON public.rune_delve_runs FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RDProgress: club read" ON public.rune_delve_progress FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RDClassProgress: club read" ON public.rune_delve_class_progress FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));
CREATE POLICY "RDDailyRuns: club read" ON public.rune_delve_daily_runs FOR SELECT
USING ((club_id = current_user_club_id()) OR is_platform_owner(auth.uid()));

-- Pools (brackets pools) — keep the invite-code lookup, add club scope
DROP POLICY IF EXISTS "Anyone can lookup pool by invite code" ON public.pools;
CREATE POLICY "Pools: club read or invite lookup" ON public.pools FOR SELECT
USING (
  (club_id = current_user_club_id())
  OR is_platform_owner(auth.uid())
  OR is_pool_member(auth.uid(), id)
);
