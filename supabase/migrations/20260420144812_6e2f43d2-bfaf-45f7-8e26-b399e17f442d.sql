-- Canonical level definitions (same for every player)
CREATE TABLE public.rune_delve_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level_number INTEGER NOT NULL UNIQUE,
  chapter INTEGER NOT NULL DEFAULT 1,
  difficulty_tier INTEGER NOT NULL DEFAULT 1,
  generation_seed BIGINT NOT NULL,
  board_size INTEGER NOT NULL DEFAULT 5,
  starting_board_layout JSONB,
  enemy_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  turn_limit INTEGER NOT NULL DEFAULT 10,
  objective_type TEXT NOT NULL DEFAULT 'defeat_all',
  objective_target INTEGER NOT NULL DEFAULT 0,
  modifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rune_delve_levels_chapter ON public.rune_delve_levels(chapter);

ALTER TABLE public.rune_delve_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Levels viewable by authenticated"
  ON public.rune_delve_levels FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert levels"
  ON public.rune_delve_levels FOR INSERT
  TO authenticated WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY "Admins can update levels"
  ON public.rune_delve_levels FOR UPDATE
  TO authenticated USING (public.is_app_admin(auth.uid()));

CREATE POLICY "Admins can delete levels"
  ON public.rune_delve_levels FOR DELETE
  TO authenticated USING (public.is_app_admin(auth.uid()));

CREATE TRIGGER update_rune_delve_levels_updated_at
  BEFORE UPDATE ON public.rune_delve_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-player campaign progress
CREATE TABLE public.rune_delve_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  highest_unlocked_level INTEGER NOT NULL DEFAULT 1,
  highest_completed_level INTEGER NOT NULL DEFAULT 0,
  total_levels_cleared INTEGER NOT NULL DEFAULT 0,
  current_chapter INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Progress viewable by authenticated"
  ON public.rune_delve_progress FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can insert own progress"
  ON public.rune_delve_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.rune_delve_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_rune_delve_progress_updated_at
  BEFORE UPDATE ON public.rune_delve_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refactor rune_delve_runs to track levels (preserve daily fields for back-compat)
ALTER TABLE public.rune_delve_runs
  ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.rune_delve_levels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS level_number INTEGER;

ALTER TABLE public.rune_delve_runs ALTER COLUMN dungeon_id DROP NOT NULL;
ALTER TABLE public.rune_delve_runs ALTER COLUMN run_date DROP NOT NULL;

-- Drop the daily uniqueness if it exists, replace with per-level uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.rune_delve_runs'::regclass
      AND conname = 'rune_delve_runs_user_id_dungeon_id_key'
  ) THEN
    ALTER TABLE public.rune_delve_runs DROP CONSTRAINT rune_delve_runs_user_id_dungeon_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rune_delve_runs_user_level_uniq
  ON public.rune_delve_runs(user_id, level_id)
  WHERE level_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rune_delve_runs_level_number
  ON public.rune_delve_runs(level_number);