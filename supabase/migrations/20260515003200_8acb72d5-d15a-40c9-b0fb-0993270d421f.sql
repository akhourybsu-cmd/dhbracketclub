
ALTER TABLE public.nfl_seasons
  ADD COLUMN IF NOT EXISTS pick_lock_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS hide_unresolved_future_weeks boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_week_window integer,
  ADD COLUMN IF NOT EXISTS require_finalized_schedule boolean NOT NULL DEFAULT true;

ALTER TABLE public.nfl_seasons
  DROP CONSTRAINT IF EXISTS nfl_seasons_pick_lock_minutes_check;
ALTER TABLE public.nfl_seasons
  ADD CONSTRAINT nfl_seasons_pick_lock_minutes_check
  CHECK (pick_lock_minutes >= 0 AND pick_lock_minutes <= 720);

ALTER TABLE public.nfl_seasons
  DROP CONSTRAINT IF EXISTS nfl_seasons_visible_week_window_check;
ALTER TABLE public.nfl_seasons
  ADD CONSTRAINT nfl_seasons_visible_week_window_check
  CHECK (visible_week_window IS NULL OR visible_week_window >= 1);

-- Returns the moment picks for a week freeze: first kickoff - season.pick_lock_minutes.
-- NULL if the week has no games yet (treated as not lockable).
CREATE OR REPLACE FUNCTION public.nfl_week_lock_at(_week_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MIN(g.kickoff_at) - make_interval(mins => COALESCE(s.pick_lock_minutes, 10))
  FROM public.nfl_games g
  JOIN public.nfl_weeks   w ON w.id = g.week_id
  JOIN public.nfl_seasons s ON s.id = w.season_id
  WHERE g.week_id = _week_id
  GROUP BY s.pick_lock_minutes
$$;

-- Replace per-game lock check with week-level lock: picks remain editable until
-- (first kickoff of the week - pick_lock_minutes), then everything in the week freezes.
CREATE OR REPLACE FUNCTION public.is_pick_unlocked(_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.nfl_games g
    WHERE g.id = _game_id
      AND g.status = 'scheduled'
      AND now() < public.nfl_week_lock_at(g.week_id)
  )
$$;
