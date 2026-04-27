ALTER TABLE public.rune_delve_daily_runs
ADD COLUMN IF NOT EXISTS kills_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rune_delve_daily_runs_date_kills
ON public.rune_delve_daily_runs (daily_date, kills_count DESC, score DESC);