
-- Heroes table
CREATE TABLE public.rune_delve_heroes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  hero_name TEXT NOT NULL DEFAULT 'Adventurer',
  class TEXT NOT NULL DEFAULT 'warrior' CHECK (class IN ('warrior','mage','rogue','cleric')),
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  lifetime_runs INTEGER NOT NULL DEFAULT 0,
  lifetime_score BIGINT NOT NULL DEFAULT 0,
  cosmetic_title TEXT,
  last_run_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_heroes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Heroes viewable by authenticated"
  ON public.rune_delve_heroes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own hero"
  ON public.rune_delve_heroes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hero"
  ON public.rune_delve_heroes FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_rune_delve_heroes_updated_at
  BEFORE UPDATE ON public.rune_delve_heroes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dungeons table (one per day, shared)
CREATE TABLE public.rune_delve_dungeons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL UNIQUE,
  seed BIGINT NOT NULL,
  enemy_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_turns INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rune_delve_dungeons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dungeons viewable by authenticated"
  ON public.rune_delve_dungeons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can seed daily dungeon"
  ON public.rune_delve_dungeons FOR INSERT TO authenticated WITH CHECK (true);

-- Runs table (one per user per dungeon)
CREATE TABLE public.rune_delve_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dungeon_id UUID NOT NULL REFERENCES public.rune_delve_dungeons(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  enemies_defeated INTEGER NOT NULL DEFAULT 0,
  dungeon_cleared BOOLEAN NOT NULL DEFAULT false,
  turns_used INTEGER NOT NULL DEFAULT 0,
  total_damage INTEGER NOT NULL DEFAULT 0,
  longest_chain INTEGER NOT NULL DEFAULT 0,
  hp_remaining INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  ability_used BOOLEAN NOT NULL DEFAULT false,
  hero_class TEXT NOT NULL,
  pick_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dungeon_id)
);

ALTER TABLE public.rune_delve_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Runs viewable by authenticated"
  ON public.rune_delve_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own runs"
  ON public.rune_delve_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_rune_delve_runs_dungeon_score ON public.rune_delve_runs (dungeon_id, score DESC);
CREATE INDEX idx_rune_delve_runs_user ON public.rune_delve_runs (user_id, run_date DESC);
