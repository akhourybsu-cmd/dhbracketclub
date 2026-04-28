-- Nexus Defense: persistent progress + per-mission best runs

CREATE TABLE public.nexus_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cores integer NOT NULL DEFAULT 0,
  unlocked_towers text[] NOT NULL DEFAULT ARRAY['pulse','arc','cryo','rail']::text[],
  unlocked_abilities text[] NOT NULL DEFAULT ARRAY['orbital','emp']::text[],
  highest_mission integer NOT NULL DEFAULT 1,
  upgrades jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nexus_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own nexus progress" ON public.nexus_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own nexus progress" ON public.nexus_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own nexus progress" ON public.nexus_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER nexus_progress_updated_at
  BEFORE UPDATE ON public.nexus_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nexus_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id integer NOT NULL,
  victory boolean NOT NULL,
  score integer NOT NULL DEFAULT 0,
  waves_cleared integer NOT NULL DEFAULT 0,
  base_hp_remaining integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  loadout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nexus_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone in club reads nexus runs" ON public.nexus_runs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "users insert own nexus runs" ON public.nexus_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX nexus_runs_mission_score_idx ON public.nexus_runs (mission_id, score DESC);
CREATE INDEX nexus_runs_user_idx ON public.nexus_runs (user_id, created_at DESC);