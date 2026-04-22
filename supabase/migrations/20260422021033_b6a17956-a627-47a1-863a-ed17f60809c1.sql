ALTER TABLE public.rune_delve_runs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS clears integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_turns_used integer,
  ADD COLUMN IF NOT EXISTS best_hp_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_at timestamptz NOT NULL DEFAULT now();

-- Backfill from existing single-snapshot data
UPDATE public.rune_delve_runs
SET
  attempts = GREATEST(attempts, 1),
  clears = CASE WHEN dungeon_cleared THEN GREATEST(clears, 1) ELSE clears END,
  best_turns_used = CASE
    WHEN dungeon_cleared AND best_turns_used IS NULL THEN turns_used
    ELSE best_turns_used
  END,
  best_hp_remaining = GREATEST(best_hp_remaining, COALESCE(hp_remaining, 0)),
  last_played_at = COALESCE(last_played_at, completed_at, now());