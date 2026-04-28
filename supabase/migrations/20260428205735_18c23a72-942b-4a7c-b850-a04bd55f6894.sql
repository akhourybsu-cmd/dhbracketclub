
ALTER TABLE public.nexus_runs
  ADD COLUMN IF NOT EXISTS failed_wave INTEGER,
  ADD COLUMN IF NOT EXISTS tower_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tower_upgrades JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tower_sells JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ability_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS energy_starved_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leaks INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS nexus_runs_mission_created_idx
  ON public.nexus_runs (mission_id, created_at DESC);
