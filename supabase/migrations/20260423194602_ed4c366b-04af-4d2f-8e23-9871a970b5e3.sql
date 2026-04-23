-- Daily Challenge run results (one per user per day)
CREATE TABLE public.rune_delve_daily_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  daily_date DATE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  dungeon_cleared BOOLEAN NOT NULL DEFAULT false,
  modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_class TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, daily_date)
);

CREATE INDEX idx_rune_delve_daily_runs_date_score
  ON public.rune_delve_daily_runs (daily_date, score DESC);
CREATE INDEX idx_rune_delve_daily_runs_user
  ON public.rune_delve_daily_runs (user_id, daily_date DESC);

ALTER TABLE public.rune_delve_daily_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily runs are readable by authenticated users"
  ON public.rune_delve_daily_runs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own daily runs"
  ON public.rune_delve_daily_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily runs"
  ON public.rune_delve_daily_runs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_rune_delve_daily_runs_updated_at
  BEFORE UPDATE ON public.rune_delve_daily_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily Challenge streak tracker (one per user)
CREATE TABLE public.rune_delve_daily_streaks (
  user_id UUID NOT NULL PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  lifetime_clears INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streak"
  ON public.rune_delve_daily_streaks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
  ON public.rune_delve_daily_streaks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
  ON public.rune_delve_daily_streaks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_rune_delve_daily_streaks_updated_at
  BEFORE UPDATE ON public.rune_delve_daily_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();