
-- Per-class progression for Rune Delve.
-- One persistent hero per user (rune_delve_heroes), with a separate XP/level/title
-- track per class. Switching classes loads the saved track instead of erasing it.
CREATE TABLE IF NOT EXISTS public.rune_delve_class_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class TEXT NOT NULL CHECK (class IN ('warrior','mage','rogue','cleric')),
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  cosmetic_title TEXT,
  lifetime_runs INTEGER NOT NULL DEFAULT 0,
  lifetime_score BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, class)
);

ALTER TABLE public.rune_delve_class_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class progress viewable by authenticated"
  ON public.rune_delve_class_progress FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own class progress"
  ON public.rune_delve_class_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own class progress"
  ON public.rune_delve_class_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_rune_delve_class_progress_updated_at
  BEFORE UPDATE ON public.rune_delve_class_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: every existing hero's current XP/level/title becomes that class's
-- saved track. Fresh classes will be created lazily on first switch.
INSERT INTO public.rune_delve_class_progress (user_id, class, xp, level, cosmetic_title)
SELECT user_id, class, COALESCE(xp,0), COALESCE(level,1), cosmetic_title
FROM public.rune_delve_heroes
ON CONFLICT (user_id, class) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_rune_delve_class_progress_user
  ON public.rune_delve_class_progress (user_id);
