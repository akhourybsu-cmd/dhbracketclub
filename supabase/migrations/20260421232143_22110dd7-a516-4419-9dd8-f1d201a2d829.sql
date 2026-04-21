-- ─────────────────────────────────────────────────────────────────────────────
-- Rune Delve — Bestiary tracking (per-player monster journal).
-- One row per (user_id, archetype_id) pair. Counts only ever increase.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.rune_delve_bestiary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  archetype_id TEXT NOT NULL,
  defeat_count INTEGER NOT NULL DEFAULT 0,
  first_defeated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_defeated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  highest_level_defeated INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rune_delve_bestiary_unique UNIQUE (user_id, archetype_id)
);

CREATE INDEX rune_delve_bestiary_user_idx
  ON public.rune_delve_bestiary (user_id);

ALTER TABLE public.rune_delve_bestiary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bestiary"
ON public.rune_delve_bestiary
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bestiary"
ON public.rune_delve_bestiary
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bestiary"
ON public.rune_delve_bestiary
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_rune_delve_bestiary_updated_at
BEFORE UPDATE ON public.rune_delve_bestiary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();