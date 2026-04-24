
-- Trigger function: auto-fill club_id from the signed-in user's membership
CREATE OR REPLACE FUNCTION public.set_club_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    NEW.club_id := public.current_user_club_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to every scoped table
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    'drafts','draft_participants','draft_picks','draft_results','draft_seasons',
    'draft_season_entries','draft_season_standings','draft_playoff_matches','draft_pick_disputes',
    'channels','channel_categories','messages','message_reactions','message_link_previews','channel_read_states',
    'events','event_rsvps','event_comments',
    'posts','post_comments','reactions',
    'polls','poll_options','poll_votes','rankings','ranking_items','ranking_submissions','ranking_submission_entries',
    'lore_entries','lore_contributions','lore_reactions',
    'lockbox_weeks','lockbox_locks','lockbox_attempts','lockbox_guesses','lockbox_scores',
    'rune_delve_runs','rune_delve_heroes','rune_delve_progress','rune_delve_class_progress',
    'rune_delve_daily_runs','rune_delve_daily_streaks','rune_delve_wallet','rune_delve_loadouts',
    'rune_delve_bestiary','rune_delve_relic_unlocks','rune_delve_active_quests','rune_delve_failure_rewards',
    'activity_feed','push_subscriptions','notification_preferences','invite_codes',
    'competitions','pools','pool_members','brackets','bracket_picks',
    'nfl_picks','nfl_season_standings','nfl_weekly_standings','nfl_tiebreakers'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_club_id ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_set_club_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_club_id_from_user()', t);
      -- Set a default so TypeScript treats club_id as optional (default is overridden by trigger anyway)
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN club_id SET DEFAULT %L', t, '11111111-1111-1111-1111-111111111111');
    END IF;
  END LOOP;
END $$;
