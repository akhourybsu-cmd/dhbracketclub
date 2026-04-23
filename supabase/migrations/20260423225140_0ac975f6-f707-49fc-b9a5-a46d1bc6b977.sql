
-- Season finalization fields
ALTER TABLE public.draft_seasons
  ADD COLUMN IF NOT EXISTS champion_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS runner_up_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS third_place_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regular_season_champion_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary jsonb;

CREATE INDEX IF NOT EXISTS idx_draft_seasons_status_starts
  ON public.draft_seasons (status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_seasons_archived_at
  ON public.draft_seasons (archived_at DESC NULLS LAST);

-- Backfill: for any existing 'complete' season, derive champion / runner-up /
-- third-place from playoff matches & regular-season standings.
DO $$
DECLARE
  s RECORD;
  v_champ uuid;
  v_runner uuid;
  v_third uuid;
  v_reg_champ uuid;
  v_g1 RECORD;
  v_win_counts jsonb;
  v_third_match RECORD;
BEGIN
  FOR s IN SELECT id FROM public.draft_seasons WHERE status = 'complete' LOOP
    -- Champion: user who won >=2 final games
    SELECT winner_user_id INTO v_champ
    FROM public.draft_playoff_matches
    WHERE season_id = s.id AND round = 'final' AND winner_user_id IS NOT NULL
    GROUP BY winner_user_id
    HAVING COUNT(*) >= 2
    LIMIT 1;

    -- Runner-up: the other finalist
    IF v_champ IS NOT NULL THEN
      SELECT CASE WHEN user_a = v_champ THEN user_b ELSE user_a END
      INTO v_runner
      FROM public.draft_playoff_matches
      WHERE season_id = s.id AND round = 'final'
      LIMIT 1;
    END IF;

    -- Third place: winner of third_place match (Bo1)
    SELECT winner_user_id INTO v_third
    FROM public.draft_playoff_matches
    WHERE season_id = s.id AND round = 'third_place' AND status = 'complete'
    LIMIT 1;

    -- Regular season champion: rank=1 from standings
    SELECT user_id INTO v_reg_champ
    FROM public.draft_season_standings
    WHERE season_id = s.id
    ORDER BY season_points DESC, wins DESC, podiums DESC, avg_finish ASC
    LIMIT 1;

    UPDATE public.draft_seasons
    SET champion_user_id = COALESCE(champion_user_id, v_champ),
        runner_up_user_id = COALESCE(runner_up_user_id, v_runner),
        third_place_user_id = COALESCE(third_place_user_id, v_third),
        regular_season_champion_user_id = COALESCE(regular_season_champion_user_id, v_reg_champ),
        archived_at = COALESCE(archived_at, now())
    WHERE id = s.id;
  END LOOP;
END $$;
